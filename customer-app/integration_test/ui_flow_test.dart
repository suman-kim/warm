import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:movo_customer/api.dart';
import 'package:movo_customer/main.dart';
import 'package:movo_customer/order/delivery_info_screen.dart';
import 'package:movo_ui/movo_ui.dart';

// 기기에서 실제 서버에 붙어, 가입부터 배송 요청·취소까지 화면으로 해 본다.
//
//   flutter test integration_test/ui_flow_test.dart -d <기기>
//
// 개발 서버가 떠 있어야 한다. Android 에뮬레이터는 먼저 `adb reverse tcp:4000 tcp:4000`.

/// [finder]가 나타날 때까지 화면을 그린다.
Future<void> waitFor(
  WidgetTester tester,
  Finder finder, {
  Duration timeout = const Duration(seconds: 15),
}) async {
  final end = DateTime.now().add(timeout);
  while (DateTime.now().isBefore(end)) {
    await tester.pump(const Duration(milliseconds: 100));
    if (finder.evaluate().isNotEmpty) return;
  }
  // 무엇이 떠 있었는지 함께 알려준다.
  final shown = [
    for (final element in find.byType(Text).evaluate())
      (element.widget as Text).data ?? '',
  ].where((text) => text.isNotEmpty).take(40).join(' | ');
  final typed = [
    for (final element in find.byType(EditableText).evaluate())
      (element.widget as EditableText).controller.text,
  ].join(' | ');
  fail('나타나지 않았어요: $finder\n화면: $shown\n입력: $typed');
}

Future<void> tap(WidgetTester tester, Finder finder) async {
  await waitFor(tester, finder);
  // 기기에서는 입력한 뒤 키보드가 떠 있다. 내리고 화면이 다시 자리 잡은 뒤에 누른다.
  FocusManager.instance.primaryFocus?.unfocus();
  await tester.pump(const Duration(milliseconds: 500));
  await tester.ensureVisible(finder.first);
  await tester.pump(const Duration(milliseconds: 100));
  await tester.tap(finder.first);
  // 화면이 넘어가는 움직임이 끝날 때까지 기다린다 — 그 전에는 입력란이 글자를 받지 못한다.
  for (var i = 0; i < 5; i++) {
    await tester.pump(const Duration(milliseconds: 200));
  }
}

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('가입 → 주소 검색 → 견적 → 배송 요청 → 취소', (tester) async {
    await api.auth.logout();
    final email = 'ui-${DateTime.now().microsecondsSinceEpoch}@test.dev';
    await tester.pumpWidget(const CustomerApp());

    // 가입
    await tap(tester, find.text('회원가입'));
    await waitFor(tester, find.text('가입하기'));
    // 가입 화면의 입력란만 (화면이 넘어가는 동안에는 로그인 화면의 입력란도 함께 잡힌다).
    final fields = find.descendant(
      of: find.byType(SignupScreen),
      matching: find.byType(EditableText),
    );
    await tester.enterText(fields.at(0), '김지은');
    await tester.enterText(fields.at(1), '010-1234-5678');
    await tester.enterText(fields.at(2), email);
    await tester.enterText(fields.at(3), 'password123');
    await tap(tester, find.text('전체 동의'));
    await tap(tester, find.text('가입하기'));
    await waitFor(tester, find.text('안녕하세요, 지은님'));

    // 서비스를 고르면 주소 단계: 출발지를 고르면 도착지를 이어서 묻는다.
    await tap(tester, find.text('퀵 배송'));
    await waitFor(tester, find.text('어디서 어디로\n보낼까요?'));
    // 서버에 카카오 키가 있으면 실제 검색, 없으면 견본 주소에서 찾는다 — 어느 쪽이든 구·동은 같다.
    await tester.enterText(find.byType(EditableText), '성수이로 113');
    await tap(tester, find.textContaining('성수동2가'));
    await tester.enterText(find.byType(EditableText), '테헤란로 152');
    await tap(tester, find.text('강남파이낸스센터 · 역삼동'));

    // 배송 정보
    await waitFor(tester, find.text('배송 정보'));
    // 받는 분은 연락처 카드 안에서 바로 입력한다 (이름, 연락처, 요청사항 순서의 입력란).
    final receiver = find.descendant(
      of: find.byType(DeliveryInfoScreen),
      matching: find.byType(TextField),
    );
    await tester.ensureVisible(receiver.at(1));
    await tester.enterText(receiver.at(0), '박서준');
    await tester.enterText(receiver.at(1), '010-5555-0123');
    await tap(tester, find.text('다음 · 차종 선택'));

    // 견적: 서버가 계산한 차종별 요금
    await waitFor(tester, find.text('배송 요청하기'));
    expect(find.text('성수동 → 역삼동'), findsOneWidget);
    expect(find.text('오토바이'), findsOneWidget);
    expect(find.text('1톤 트럭'), findsNothing);
    await tap(tester, find.text('다마스'));
    await tap(tester, find.text('배송 요청하기'));

    // 기사 찾는 중 → 취소
    await waitFor(tester, find.text('기사님을 찾고 있어요'));
    expect(find.textContaining('다마스 · 박스 1개'), findsOneWidget);
    await tap(tester, find.text('요청 취소'));
    await tap(tester, find.text('주문 취소'));
    await waitFor(tester, find.text('안녕하세요, 지은님'));

    // 이용 내역에 취소한 주문이 남고, 홈에는 최근 보낸 경로가 생긴다.
    await tap(tester, find.text('이용 내역'));
    await waitFor(tester, find.text('취소'));
    expect(find.text('성수동 → 역삼동'), findsOneWidget);
    await tap(tester, find.text('홈'));
    await waitFor(tester, find.text('다시 보내기'));

    // 마이 → 로그아웃
    await tap(tester, find.text('마이'));
    await waitFor(tester, find.text(email));
    await tap(tester, find.text('로그아웃'));
    await tap(tester, find.text('로그아웃').last);
    await waitFor(tester, find.text('로그인하고\n바로 배송을 요청하세요'));
    expect(await api.auth.isSignedIn(), isFalse);
  });
}
