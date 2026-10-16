import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:movo_api/movo_api.dart';

import 'support/fake_server.dart';

void main() {
  group('요청', () {
    test('로그인한 뒤의 호출에는 액세스 토큰이 붙는다', () async {
      final server = FakeServer(
        (_) async => json(userJson),
        signedInWith: signedIn,
      );

      await server.api.users.me();

      expect(server.calls, ['GET /api/users/me']);
      expect(bearer(server.requests.single), 'Bearer access-old');
    });

    test('로그인 없이 부르는 API에는 토큰을 붙이지 않는다', () async {
      final server = FakeServer((_) async => json([]), signedInWith: signedIn);

      await server.api.legal.documents();

      expect(bearer(server.requests.single), isNull);
    });

    test('쿼리에서 값이 없는 항목은 뺀다', () async {
      final server = FakeServer(
        (_) async => json({'items': [], 'total': 0, 'page': 2, 'size': 10}),
        signedInWith: signedIn,
      );

      await server.api.orders.list(page: 2, size: 10);
      await server.api.orders.list(status: OrderStatus.pickedUp);

      expect(
        server.requests[0].url.toString(),
        '$baseUrl/orders?page=2&size=10',
      );
      expect(server.requests[1].url.queryParameters, {
        'status': 'PICKED_UP',
        'page': '1',
        'size': '20',
      });
    });

    test('본문이 없는 응답(204)도 성공이다', () async {
      final server = FakeServer(
        (_) async => http.Response('', 204),
        signedInWith: signedIn,
      );

      await server.api.pushDevices.unregister('fcm:token/with space');

      expect(
        server.requests.single.url.toString(),
        '$baseUrl/push-devices/fcm%3Atoken%2Fwith%20space',
      );
    });
  });

  group('파일', () {
    final file = UploadFile(
      bytes: Uint8List.fromList([0xff, 0xd8, 0xff, 0xe0]),
      filename: 'license.jpg',
    );
    const documents = [
      {
        'type': 'DRIVER_LICENSE',
        'status': 'SUBMITTED',
        'rejectionReason': null,
        'uploadedAt': '2026-10-13T01:07:18.278Z',
      },
    ];

    test('multipart/form-data의 file 항목으로 올린다', () async {
      final server = FakeServer(
        (_) async => json(documents),
        appRole: UserRole.driver,
        signedInWith: signedIn,
      );

      final result = await server.api.drivers.uploadDocument(
        DriverDocumentType.driverLicense,
        file,
      );

      final request = server.requests.single;
      expect(server.calls, ['PUT /api/drivers/me/documents/DRIVER_LICENSE']);
      expect(bearer(request), 'Bearer access-old');
      expect(
        request.headers['content-type'],
        startsWith('multipart/form-data; boundary='),
      );
      final body = latin1.decode(request.bodyBytes);
      expect(body, contains('name="file"; filename="license.jpg"'));
      expect(body, contains(latin1.decode(file.bytes)));
      expect(result.single.status, DriverDocumentStatus.submitted);
    });

    test('올리는 중에 토큰이 만료되면 갱신하고 파일을 다시 보낸다', () async {
      final server = FakeServer(
        (request) async {
          if (request.url.path == '/api/auth/refresh') return tokens('new');
          return bearer(request) == 'Bearer access-new'
              ? json(documents)
              : error(401, 'INVALID_ACCESS_TOKEN', '로그인이 필요해요.');
        },
        appRole: UserRole.driver,
        signedInWith: signedIn,
      );

      await server.api.drivers.uploadDocument(
        DriverDocumentType.driverLicense,
        file,
      );

      expect(server.calls, [
        'PUT /api/drivers/me/documents/DRIVER_LICENSE',
        'POST /api/auth/refresh',
        'PUT /api/drivers/me/documents/DRIVER_LICENSE',
      ]);
      // 두 번째에도 파일이 온전히 실려 있다.
      expect(
        latin1.decode(server.requests.last.bodyBytes),
        contains(latin1.decode(file.bytes)),
      );
    });

    test('내려받은 파일은 바이트와 형식을 그대로 준다', () async {
      final pdf = utf8.encode('%PDF-1.7');
      final server = FakeServer(
        (_) async => http.Response.bytes(
          pdf,
          200,
          headers: {'content-type': 'application/pdf'},
        ),
        appRole: UserRole.driver,
        signedInWith: signedIn,
      );

      final content = await server.api.drivers.documentFile(
        DriverDocumentType.vehicleRegistration,
      );

      expect(server.calls, [
        'GET /api/drivers/me/documents/VEHICLE_REGISTRATION/file',
      ]);
      expect(content.bytes, pdf);
      expect(content.contentType, 'application/pdf');
    });

    test('파일 요청의 실패도 서버의 오류 코드로 온다', () async {
      final server = FakeServer(
        (request) async => request.method == 'GET'
            ? error(404, 'DOCUMENT_NOT_FOUND', '서류를 찾을 수 없어요.')
            : error(
                400,
                'UNSUPPORTED_DOCUMENT_TYPE',
                '사진(JPG·PNG·WEBP·HEIC)이나 PDF만 올릴 수 있어요.',
              ),
        appRole: UserRole.driver,
        signedInWith: signedIn,
      );

      await expectLater(
        server.api.drivers.documentFile(DriverDocumentType.driverLicense),
        throwsA(
          isA<ApiException>().having((e) => e.statusCode, 'statusCode', 404),
        ),
      );
      await expectLater(
        server.api.drivers.uploadDocument(
          DriverDocumentType.driverLicense,
          file,
        ),
        throwsA(
          isA<ApiException>().having(
            (e) => e.code,
            'code',
            ApiErrorCode.unsupportedDocumentType,
          ),
        ),
      );
    });
  });

  group('오류', () {
    test('서버의 오류 코드와 메시지를 담아 던진다', () async {
      final server = FakeServer(
        (_) async => error(409, 'ORDER_NOT_OPEN', '이미 배차됐거나 취소된 배달이에요.'),
        appRole: UserRole.driver,
        signedInWith: signedIn,
      );

      await expectLater(
        server.api.dispatch.accept('order-1'),
        throwsA(
          isA<ApiException>()
              .having((e) => e.statusCode, 'statusCode', 409)
              .having((e) => e.code, 'code', ApiErrorCode.orderNotOpen)
              .having((e) => e.message, 'message', '이미 배차됐거나 취소된 배달이에요.'),
        ),
      );
    });

    test('입력 검증 실패는 항목별 메시지를 모두 담는다', () async {
      final server = FakeServer(
        (_) async => error(400, 'VALIDATION_FAILED', [
          'email must be an email',
          'password must be longer than or equal to 8 characters',
        ]),
      );

      await expectLater(
        server.api.auth.login(email: 'nope', password: 'x'),
        throwsA(
          isA<ApiException>()
              .having((e) => e.code, 'code', ApiErrorCode.validationFailed)
              .having((e) => e.messages, 'messages', hasLength(2)),
        ),
      );
    });

    test('서버 앞단이 만든 오류(JSON 아님)도 ApiException으로 온다', () async {
      final server = FakeServer(
        (_) async => http.Response('<html>Bad Gateway</html>', 502),
        signedInWith: signedIn,
      );

      await expectLater(
        server.api.users.me(),
        throwsA(
          isA<ApiException>()
              .having((e) => e.statusCode, 'statusCode', 502)
              .having((e) => e.code, 'code', 'HTTP_502'),
        ),
      );
    });

    test('서버에 닿지 못하면 NetworkException', () async {
      final unreachable = FakeServer(
        (_) async => throw http.ClientException('Connection refused'),
        signedInWith: signedIn,
      );
      final slow = MovoApi(
        baseUrl: Uri.parse(baseUrl),
        appRole: UserRole.customer,
        tokenStore: MemoryTokenStore(signedIn),
        httpClient: MockClient((_) => Completer<http.Response>().future),
        timeout: const Duration(milliseconds: 20),
      );

      await expectLater(
        unreachable.api.users.me(),
        throwsA(isA<NetworkException>()),
      );
      await expectLater(slow.users.me(), throwsA(isA<NetworkException>()));
    });

    test('모양이 다른 응답은 UnexpectedResponseException', () async {
      final server = FakeServer(
        (_) async => json({'id': 'user-1'}),
        signedInWith: signedIn,
      );

      await expectLater(
        server.api.users.me(),
        throwsA(isA<UnexpectedResponseException>()),
      );
    });
  });

  group('토큰 갱신', () {
    /// 예전 액세스 토큰에는 401, 갱신 뒤의 토큰에는 회원 정보를 주는 서버.
    Future<http.Response> expiring(http.Request request) async {
      if (request.url.path == '/api/auth/refresh') {
        final body = jsonDecode(request.body) as Map<String, dynamic>;
        return body['refreshToken'] == 'refresh-old'
            ? tokens('new')
            : error(401, 'INVALID_REFRESH_TOKEN', '다시 로그인해 주세요.');
      }
      return bearer(request) == 'Bearer access-new'
          ? json(userJson)
          : error(401, 'INVALID_ACCESS_TOKEN', '로그인이 필요해요.');
    }

    test('액세스 토큰이 만료되면 갱신하고 같은 요청을 다시 보낸다', () async {
      final server = FakeServer(expiring, signedInWith: signedIn);

      final user = await server.api.users.me();

      expect(user.email, 'customer@test.dev');
      expect(server.calls, [
        'GET /api/users/me',
        'POST /api/auth/refresh',
        'GET /api/users/me',
      ]);
      // 새 토큰이 보관돼 다음 요청부터는 바로 통과한다.
      expect((await server.store.read())?.refreshToken, 'refresh-new');
      await server.api.users.me();
      expect(server.count('POST /api/auth/refresh'), 1);
    });

    test('동시에 여러 요청이 만료를 만나도 갱신은 한 번만 한다', () async {
      final server = FakeServer(expiring, signedInWith: signedIn);

      final users = await Future.wait([
        for (var i = 0; i < 5; i++) server.api.users.me(),
      ]);

      expect(users, hasLength(5));
      // 리프레시 토큰은 한 번 쓰면 폐기된다 — 두 번 갱신했다면 두 번째는 401이었을 것이다.
      expect(server.count('POST /api/auth/refresh'), 1);
    });

    test('늦게 도착한 401은 이미 갱신된 토큰으로 다시 보낸다', () async {
      final slowRequest = Completer<void>();
      final server = FakeServer((request) async {
        if (request.url.path == '/api/drivers/me' &&
            bearer(request) == 'Bearer access-old') {
          await slowRequest.future;
        }
        if (request.url.path == '/api/drivers/me' &&
            bearer(request) == 'Bearer access-new') {
          return error(404, 'DRIVER_NOT_REGISTERED', '라이더 등록을 먼저 해 주세요.');
        }
        return expiring(request);
      }, signedInWith: signedIn);

      final slow = server.api.drivers.me();
      await server.api.users.me();
      slowRequest.complete();

      expect(await slow, isNull);
      expect(server.count('POST /api/auth/refresh'), 1);
    });

    test('리프레시 토큰도 만료됐으면 로그인이 풀린다', () async {
      final server = FakeServer(
        expiring,
        signedInWith: const AuthTokens(
          accessToken: 'access-old',
          refreshToken: 'refresh-revoked',
        ),
      );
      final expired = <void>[];
      server.api.sessionExpired.listen(expired.add);

      await expectLater(
        server.api.users.me(),
        throwsA(
          isA<SessionExpiredException>().having(
            (e) => e.code,
            'code',
            ApiErrorCode.sessionExpired,
          ),
        ),
      );
      await pumpEventQueue();

      expect(expired, hasLength(1));
      expect(await server.store.read(), isNull);
      expect(await server.api.auth.isSignedIn(), isFalse);
    });

    test('갱신이 서버 오류로 실패하면 로그인을 풀지 않는다', () async {
      final server = FakeServer((request) async {
        if (request.url.path == '/api/auth/refresh') {
          return error(500, 'INTERNAL_SERVER_ERROR', '서버 오류가 발생했어요.');
        }
        return error(401, 'INVALID_ACCESS_TOKEN', '로그인이 필요해요.');
      }, signedInWith: signedIn);

      await expectLater(
        server.api.users.me(),
        throwsA(
          isA<ApiException>().having((e) => e.statusCode, 'statusCode', 500),
        ),
      );

      expect((await server.store.read())?.refreshToken, 'refresh-old');
    });

    test('로그인하지 않은 상태의 401은 갱신하지 않고 그대로 던진다', () async {
      final server = FakeServer(
        (_) async => error(401, 'INVALID_ACCESS_TOKEN', '로그인이 필요해요.'),
      );

      await expectLater(
        server.api.users.me(),
        throwsA(
          isA<ApiException>().having(
            (e) => e.code,
            'code',
            'INVALID_ACCESS_TOKEN',
          ),
        ),
      );

      expect(server.calls, ['GET /api/users/me']);
    });
  });
}
