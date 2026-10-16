import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:movo_api/movo_api.dart';

import 'support/fake_server.dart';

final driverJson = {...userJson, 'id': 'user-2', 'role': 'DRIVER'};

void main() {
  test('가입은 이 앱의 역할로 하고, 받은 토큰을 보관한다', () async {
    final server = FakeServer(
      (_) async => tokens('new', user: driverJson),
      appRole: UserRole.driver,
    );

    final user = await server.api.auth.register(
      email: 'driver@test.dev',
      password: 'password123',
      name: '박라이더',
      phone: '010-3333-4444',
      agreements: const Agreements(terms: true, privacy: true),
    );

    expect(user.role, UserRole.driver);
    expect(server.calls, ['POST /api/auth/register']);
    expect(bodyOf(server.requests.single), {
      'email': 'driver@test.dev',
      'password': 'password123',
      'name': '박라이더',
      'phone': '010-3333-4444',
      'role': 'DRIVER',
      // 마케팅 수신은 따로 고르지 않으면 동의하지 않은 것으로 보낸다.
      'agreements': {'terms': true, 'privacy': true, 'marketing': false},
    });
    expect((await server.store.read())?.accessToken, 'access-new');
    expect(await server.api.auth.isSignedIn(), isTrue);
  });

  test('다른 앱의 계정으로는 로그인되지 않고, 받은 토큰은 폐기한다', () async {
    final server = FakeServer(
      (request) async => request.url.path == '/api/auth/login'
          ? tokens('driver', user: driverJson)
          : http.Response('', 204),
      appRole: UserRole.customer,
    );

    await expectLater(
      server.api.auth.login(email: 'driver@test.dev', password: 'password123'),
      throwsA(
        isA<WrongAppException>()
            .having((e) => e.expected, 'expected', UserRole.customer)
            .having((e) => e.actual, 'actual', UserRole.driver),
      ),
    );

    expect(server.calls, ['POST /api/auth/login', 'POST /api/auth/logout']);
    expect(bodyOf(server.requests.last), {'refreshToken': 'refresh-driver'});
    expect(await server.store.read(), isNull);
  });

  test('로그아웃은 서버에 닿지 못해도 기기에서는 로그아웃시킨다', () async {
    final server = FakeServer(
      (_) async => throw http.ClientException('offline'),
      signedInWith: signedIn,
    );

    await server.api.auth.logout();

    expect(server.calls, ['POST /api/auth/logout']);
    expect(await server.store.read(), isNull);
    // 이미 로그아웃한 상태에서는 서버를 부르지 않는다.
    await server.api.auth.logout();
    expect(server.calls, hasLength(1));
  });

  test('비밀번호 찾기는 로그인 없이 코드를 받고, 코드와 새 비밀번호를 보낸다', () async {
    final server = FakeServer(
      (_) async => http.Response('', 204),
      signedInWith: signedIn,
    );

    await server.api.auth.requestPasswordReset(email: 'customer@test.dev');
    await server.api.auth.confirmPasswordReset(
      email: 'customer@test.dev',
      code: '482913',
      newPassword: 'newpass456',
    );

    expect(server.calls, [
      'POST /api/auth/password-reset/request',
      'POST /api/auth/password-reset/confirm',
    ]);
    expect(server.requests.map(bearer), [null, null]);
    expect(bodyOf(server.requests.last), {
      'email': 'customer@test.dev',
      'code': '482913',
      'newPassword': 'newpass456',
    });
    // 비밀번호를 바꾼다고 이 기기의 로그인 상태를 건드리지는 않는다.
    expect(await server.api.auth.isSignedIn(), isTrue);
  });

  group('withdraw', () {
    test('탈퇴하면 이 기기에서도 로그아웃된다', () async {
      final server = FakeServer(
        (_) async => http.Response('', 204),
        signedInWith: signedIn,
      );

      await server.api.auth.withdraw(password: 'password123');

      expect(server.calls, ['POST /api/users/me/withdraw']);
      expect(bearer(server.requests.single), 'Bearer access-old');
      expect(bodyOf(server.requests.single), {'password': 'password123'});
      expect(await server.store.read(), isNull);
    });

    test('탈퇴가 거절되면 로그인은 그대로다', () async {
      final server = FakeServer(
        (_) async =>
            error(409, 'ORDER_IN_PROGRESS', '진행 중인 배달이 끝난 뒤에 탈퇴할 수 있어요.'),
        signedInWith: signedIn,
      );

      await expectLater(
        server.api.auth.withdraw(password: 'password123'),
        throwsA(
          isA<ApiException>().having(
            (e) => e.code,
            'code',
            ApiErrorCode.orderInProgress,
          ),
        ),
      );

      expect(await server.api.auth.isSignedIn(), isTrue);
    });
  });

  group('restoreSession', () {
    test('로그인한 적이 없으면 서버를 부르지 않고 null', () async {
      final server = FakeServer((_) async => json(userJson));

      expect(await server.api.auth.restoreSession(), isNull);
      expect(server.calls, isEmpty);
    });

    test('저장된 로그인이 유효하면 회원을 준다', () async {
      final server = FakeServer(
        (_) async => json(userJson),
        signedInWith: signedIn,
      );

      expect((await server.api.auth.restoreSession())?.name, '김사장');
    });

    test('로그인이 풀렸으면 null', () async {
      final server = FakeServer(
        (request) async => request.url.path == '/api/auth/refresh'
            ? error(401, 'INVALID_REFRESH_TOKEN', '다시 로그인해 주세요.')
            : error(401, 'INVALID_ACCESS_TOKEN', '로그인이 필요해요.'),
        signedInWith: signedIn,
      );

      expect(await server.api.auth.restoreSession(), isNull);
      expect(await server.api.auth.isSignedIn(), isFalse);
    });

    test('서버에 닿지 못하면 NetworkException — 로그인은 유지된다', () async {
      final server = FakeServer(
        (_) async => throw http.ClientException('offline'),
        signedInWith: signedIn,
      );

      await expectLater(
        server.api.auth.restoreSession(),
        throwsA(isA<NetworkException>()),
      );
      expect(await server.api.auth.isSignedIn(), isTrue);
    });
  });
}
