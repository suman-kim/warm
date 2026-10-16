import 'package:flutter_test/flutter_test.dart';
import 'package:movo_api/movo_api.dart';
import 'package:movo_driver/main.dart';
import 'package:movo_testkit/movo_testkit.dart';

void main() {
  testScreen('로그인하지 않았으면 로그인 화면이 뜬다', (tester) async {
    final backend = FakeBackend();

    await pumpApp(
      tester,
      DriverApp(api: backend.api(UserRole.driver, signedIn: false)),
    );

    expect(find.text('라이더 계정으로\n로그인해 주세요'), findsOneWidget);
    expect(find.text('처음이에요 · 라이더 가입'), findsOneWidget);
    expect(backend.calls, isEmpty);
  });

  testScreen('가입만 하고 서류를 내지 않은 라이더는 서류 단계로 간다', (tester) async {
    final backend = FakeBackend()
      ..on('GET', '/users/me', (_, _) => driverUserJson())
      ..fail('GET', '/drivers/me', status: 404, code: 'DRIVER_NOT_REGISTERED')
      ..on(
        'GET',
        '/drivers/me/documents',
        (_, _) => documentsJson(const [
          'NOT_SUBMITTED',
          'NOT_SUBMITTED',
          'NOT_SUBMITTED',
        ]),
      );

    await pumpApp(tester, DriverApp(api: backend.api(UserRole.driver)));

    expect(find.text('오토바이와 서류'), findsOneWidget);
    expect(find.text('올리기'), findsNWidgets(3));
  });
}
