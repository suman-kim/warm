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

    expect(find.text('로그인하고\n바로 배송을 요청하세요'), findsOneWidget);
    // 저장된 로그인이 없으니 서버에 묻지 않는다.
    expect(backend.calls, isEmpty);
  });

  testScreen('저장된 로그인이 있으면 홈이 뜬다', (tester) async {
    final backend = FakeBackend()
      ..on('GET', '/users/me', (_, _) => userJson())
      ..on('GET', '/orders', (_, _) => pageJson(const []))
      ..on('GET', '/notifications/unread-count', (_, _) => {'unreadCount': 0});

    await pumpApp(tester, CustomerApp(api: backend.api(UserRole.customer)));

    expect(find.text('안녕하세요, 지은님'), findsOneWidget);
    expect(find.text('이용 내역'), findsOneWidget);
  });

  testScreen('로그인하면 홈으로 들어간다', (tester) async {
    final backend = FakeBackend()
      ..on('POST', '/auth/login', (_, _) => authJson(userJson()))
      ..on('GET', '/orders', (_, _) => pageJson(const []))
      ..on('GET', '/notifications/unread-count', (_, _) => {'unreadCount': 0});
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
    expect(find.text('안녕하세요, 지은님'), findsOneWidget);
  });

  testScreen('기사 계정으로 로그인하면 안내 화면을 보여주고 들여보내지 않는다', (tester) async {
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

    expect(find.text('기사 계정으로\n로그인했어요'), findsOneWidget);
    expect(find.text('기사 계정'), findsOneWidget);
    await screenshot(tester, 'common-wrong-app');

    await tester.tap(find.text('다른 계정으로 로그인'));
    await settle(tester);
    expect(find.text('로그인하고\n바로 배송을 요청하세요'), findsOneWidget);
  });
}
