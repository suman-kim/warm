import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:movo_api/movo_api.dart';

const baseUrl = 'https://api.test/api';

const userJson = {
  'id': 'user-1',
  'email': 'customer@test.dev',
  'name': '김고객',
  'phone': '01011112222',
  'role': 'CUSTOMER',
  'marketingAgreed': false,
  'createdAt': '2026-10-13T01:07:18.278Z',
};

http.Response json(Object? body, [int status = 200]) => http.Response.bytes(
  utf8.encode(jsonEncode(body)),
  status,
  headers: {'content-type': 'application/json; charset=utf-8'},
);

http.Response error(int status, String code, Object message) => json({
  'statusCode': status,
  'code': code,
  'message': message,
  'timestamp': '2026-10-13T01:07:18.278Z',
  'path': '/api/somewhere',
}, status);

http.Response tokens(String name, {Map<String, Object?> user = userJson}) =>
    json({
      'accessToken': 'access-$name',
      'refreshToken': 'refresh-$name',
      'user': user,
    });

/// 가짜 서버가 달린 API. 받은 요청을 [requests]에 기록한다.
class FakeServer {
  FakeServer(
    Future<http.Response> Function(http.Request request) handler, {
    UserRole appRole = UserRole.customer,
    AuthTokens? signedInWith,
  }) : store = MemoryTokenStore(signedInWith) {
    api = MovoApi(
      baseUrl: Uri.parse(baseUrl),
      appRole: appRole,
      tokenStore: store,
      httpClient: MockClient((request) {
        requests.add(request);
        return handler(request);
      }),
    );
  }

  final MemoryTokenStore store;
  final requests = <http.Request>[];
  late final MovoApi api;

  /// 받은 요청을 "메서드 경로"로 (예: `POST /api/auth/refresh`).
  List<String> get calls => [
    for (final request in requests) '${request.method} ${request.url.path}',
  ];

  int count(String call) => calls.where((each) => each == call).length;
}

const signedIn = AuthTokens(
  accessToken: 'access-old',
  refreshToken: 'refresh-old',
);

String? bearer(http.Request request) => request.headers['Authorization'];

/// 요청 본문(JSON).
Map<String, dynamic> bodyOf(http.Request request) =>
    jsonDecode(request.body) as Map<String, dynamic>;
