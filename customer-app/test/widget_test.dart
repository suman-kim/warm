import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:movo_api/movo_api.dart';
import 'package:movo_customer/main.dart';
import 'package:movo_testkit/movo_testkit.dart';

void main() {
  testScreen('로그인하지 않았으면 로그인 화면이 뜬다', (tester) async {
    final backend = FakeBackend();

    await pumpApp(
      tester,
      CustomerApp(api: backend.api(UserRole.customer, signedIn: false)),
    );

    expect(find.text('가게 계정으로\n로그인해 주세요'), findsOneWidget);
    // 저장된 로그인이 없으니 서버에 묻지 않는다.
    expect(backend.calls, isEmpty);
  });

  testScreen('저장된 로그인이 있으면 가게 홈이 뜬다', (tester) async {
    final backend = FakeBackend()
      ..on('GET', '/users/me', (_, _) => userJson())
      ..on('GET', '/stores/me', (_, _) => storeJson())
      ..on('GET', '/orders', (_, _) => pageJson(const []));

    await pumpApp(tester, CustomerApp(api: backend.api(UserRole.customer)));

    expect(find.text('모보치킨 역삼점'), findsOneWidget);
    expect(find.text('배달 요청'), findsOneWidget);
    expect(find.text('충전금'), findsWidgets);
  });

  testScreen('로그인했는데 가게가 없으면 가게 등록부터 한다', (tester) async {
    final backend = FakeBackend()
      ..on('POST', '/auth/login', (_, _) => authJson(userJson()))
      ..fail('GET', '/stores/me', status: 404, code: 'STORE_NOT_REGISTERED');
    await pumpApp(
      tester,
      CustomerApp(api: backend.api(UserRole.customer, signedIn: false)),
    );

    await tester.enterText(
      find.byType(EditableText).first,
      'jieun.kim@gmail.com',
    );
    await tester.enterText(find.byType(EditableText).last, 'password123');
    await tester.tap(find.text('로그인'));
    await settle(tester);

    expect(backend.bodyOf('POST /auth/login'), {
      'email': 'jieun.kim@gmail.com',
      'password': 'password123',
    });
    expect(find.text('가게를 먼저\n등록해 주세요'), findsOneWidget);
  });

  testScreen('라이더 계정으로 로그인하면 안내 화면을 보여주고 들여보내지 않는다', (tester) async {
    final backend = FakeBackend()
      ..on('POST', '/auth/login', (_, _) => authJson(driverUserJson()))
      ..on('POST', '/auth/logout', (_, _) => null);
    await pumpApp(
      tester,
      CustomerApp(api: backend.api(UserRole.customer, signedIn: false)),
    );

    await tester.enterText(
      find.byType(EditableText).first,
      'doyun.kim@gmail.com',
    );
    await tester.enterText(find.byType(EditableText).last, 'password123');
    await tester.tap(find.text('로그인'));
    await settle(tester);

    expect(find.text('라이더 계정으로\n로그인했어요'), findsOneWidget);
    expect(find.text('라이더 계정'), findsOneWidget);
    await screenshot(tester, 'common-wrong-app');

    await tester.tap(find.text('다른 계정으로 로그인'));
    await settle(tester);
    expect(find.text('가게 계정으로\n로그인해 주세요'), findsOneWidget);
  });
}
