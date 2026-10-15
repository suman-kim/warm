import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:movo_api/movo_api.dart';
import 'package:movo_customer/api.dart';

// 기기(시뮬레이터·에뮬레이터)에서 서버 연결과 토큰 보관을 확인한다. 개발 서버가 떠 있어야 한다.
//
//   flutter test integration_test -d <기기>
//
// Android 에뮬레이터는 먼저 `adb reverse tcp:4000 tcp:4000`.
void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  MovoApi relaunched() =>
      MovoApi(baseUrl: environment.apiBaseUrl, appRole: UserRole.customer);

  testWidgets('가입하면 토큰이 기기에 보관되고, 앱을 다시 켜도 로그인이 유지된다', (tester) async {
    await api.auth.logout();
    final user = await api.auth.register(
      email: 'device-${DateTime.now().microsecondsSinceEpoch}@test.dev',
      password: 'password123',
      name: '기기 테스트',
      phone: '010-1234-5678',
      agreements: const Agreements(terms: true, privacy: true),
    );
    expect(user.role, UserRole.customer);

    // 앱을 다시 켠 것처럼 새로 만든다 — 토큰을 보안 저장소에서 읽어야 한다.
    final afterRelaunch = relaunched();
    expect((await afterRelaunch.auth.restoreSession())?.id, user.id);

    await afterRelaunch.auth.logout();
    expect(await relaunched().auth.isSignedIn(), isFalse);
  });
}
