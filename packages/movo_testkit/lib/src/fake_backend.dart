import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:movo_api/movo_api.dart';

import 'fixtures.dart';

typedef FakeReply =
    Object? Function(http.Request request, Map<String, String> params);

/// 가짜 서버. 경로마다 돌려줄 응답을 정해 두고, 받은 요청을 기록한다.
///
/// ```dart
/// final backend = FakeBackend()
///   ..on('GET', '/orders/:id', (request, params) => orderJson(id: params['id']));
/// final api = backend.api(UserRole.customer);
/// ```
class FakeBackend {
  /// 화면 대부분이 부르는 값은 기본으로 답한다 (테스트에서 덮어쓸 수 있다):
  /// 요금 규칙, 사업자 정보, 등록한 카드 한 장, 요금 견적, 견본 주소에서 찾는 주소 검색.
  FakeBackend() {
    on('GET', '/orders/charge-policy', (_, _) => chargeRulesJson());
    on('GET', '/support/business', (_, _) => businessJson());
    on('GET', '/payment-methods', (_, _) => [paymentMethodJson()]);
    on('POST', '/orders/estimates', (_, _) => estimatesJson());
    on(
      'GET',
      '/address-search',
      (request, _) =>
          searchSampleAddresses(request.url.queryParameters['query'] ?? ''),
    );
  }

  final _routes = <(String, RegExp, List<String>, FakeReply, int)>[];

  /// true인 동안에는 서버에 닿지 못하는 것처럼 군다 (연결 오류).
  bool offline = false;

  /// 받은 요청을 "메서드 경로"로 (예: `POST /orders`).
  final calls = <String>[];
  final requests = <http.Request>[];

  /// [path]의 `:이름` 자리는 아무 값이나 받고 [FakeReply]의 params로 넘긴다.
  /// 나중에 등록한 것이 먼저 맞는다 — 기본 응답을 테스트에서 덮어쓸 수 있다.
  ///
  /// [reply]가 [http.Response]를 돌려주면 그대로 보내고, 그 밖의 값은 JSON으로 보낸다.
  void on(String method, String path, FakeReply reply, {int status = 200}) {
    final names = <String>[];
    final pattern = RegExp(
      '^${path.replaceAllMapped(RegExp(r':(\w+)'), (match) {
        names.add(match.group(1)!);
        return '([^/]+)';
      })}\$',
    );
    _routes.insert(0, (method, pattern, names, reply, status));
  }

  /// 이 경로를 부르면 서버의 오류 형식으로 답한다.
  void fail(
    String method,
    String path, {
    required int status,
    required String code,
    String message = '요청을 처리하지 못했어요.',
  }) => on(method, path, (_, _) => errorResponse(status, code, message));

  /// 이 가짜 서버에 붙는 API. [signedIn]이면 로그인된 상태로 시작한다.
  MovoApi api(UserRole role, {bool signedIn = true}) => MovoApi(
    baseUrl: Uri.parse('https://api.test/api'),
    appRole: role,
    tokenStore: MemoryTokenStore(
      signedIn
          ? const AuthTokens(accessToken: 'access', refreshToken: 'refresh')
          : null,
    ),
    httpClient: MockClient(_handle),
  );

  int count(String call) => calls.where((each) => each == call).length;

  /// 그 호출의 마지막 요청 본문(JSON).
  Map<String, dynamic> bodyOf(String call) {
    final index = calls.lastIndexOf(call);
    if (index < 0) throw StateError('부르지 않았어요: $call\n부른 것: $calls');
    return jsonDecode(requests[index].body) as Map<String, dynamic>;
  }

  Future<http.Response> _handle(http.Request request) async {
    final path = request.url.path.replaceFirst('/api', '');
    if (offline) throw http.ClientException('연결할 수 없음', request.url);
    calls.add('${request.method} $path');
    requests.add(request);
    // 실제 서버처럼 고정된 경로(/orders/charge-policy)가 `:이름`이 든 경로(/orders/:id)보다 먼저 맞는다.
    final ordered = [
      ..._routes.where((route) => route.$3.isEmpty),
      ..._routes.where((route) => route.$3.isNotEmpty),
    ];
    for (final (method, pattern, names, reply, status) in ordered) {
      final match = method == request.method ? pattern.firstMatch(path) : null;
      if (match == null) continue;
      final result = reply(request, {
        for (final (index, name) in names.indexed)
          name: match.group(index + 1)!,
      });
      if (result is http.Response) return result;
      if (result == null) {
        return http.Response('', status == 200 ? 204 : status);
      }
      return jsonResponse(result, status);
    }
    // 준비하지 않은 경로를 부르면 테스트가 바로 알 수 있게 한다.
    throw StateError('가짜 서버에 없는 경로예요: ${request.method} $path');
  }
}

http.Response jsonResponse(Object? body, [int status = 200]) =>
    http.Response.bytes(
      utf8.encode(jsonEncode(body)),
      status,
      headers: {'content-type': 'application/json; charset=utf-8'},
    );

http.Response errorResponse(int status, String code, String message) =>
    jsonResponse({
      'statusCode': status,
      'code': code,
      'message': message,
      'timestamp': '2026-10-13T05:00:00.000Z',
      'path': '/api',
    }, status);
