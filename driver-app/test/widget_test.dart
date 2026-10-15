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

    expect(find.text('기사님, 오늘도\n안전 운행하세요'), findsOneWidget);
    expect(find.text('기사 회원가입'), findsOneWidget);
    expect(backend.calls, isEmpty);
  });

  testScreen('가입만 하고 차량을 등록하지 않은 기사는 차량·서류 단계로 간다', (tester) async {
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

    expect(find.text('차량과 서류'), findsOneWidget);
    expect(find.text('서류 3개를 더 올리면 신청할 수 있어요'), findsOneWidget);
  });
}
