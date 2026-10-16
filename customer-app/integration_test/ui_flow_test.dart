import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:movo_customer/api.dart';
import 'package:movo_customer/main.dart';
import 'package:movo_ui/movo_ui.dart';

// 기기에서 실제 서버에 붙어, 사장님 가입부터 가게 등록(심사 신청)까지 화면으로 해 본다.
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

/// 검증 숫자가 맞는 아무 사업자등록번호 (실행할 때마다 다르게).
String randomBusinessNumber() {
  final seed = DateTime.now().microsecondsSinceEpoch;
  final digits = [for (var i = 0; i < 9; i++) (seed ~/ _pow10(i)) % 10];
  const weights = [1, 3, 7, 1, 3, 7, 1, 3, 5];
  var sum = 0;
  for (var i = 0; i < 9; i++) {
    sum += weights[i] * digits[i];
  }
  sum += (digits[8] * 5) ~/ 10;
  return [...digits, (10 - sum % 10) % 10].join();
}

int _pow10(int n) => n == 0 ? 1 : 10 * _pow10(n - 1);

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('가입 → 가게 등록 → 심사 대기 → 로그아웃', (tester) async {
    await api.auth.logout();
    final email = 'ui-${DateTime.now().microsecondsSinceEpoch}@test.dev';
    await tester.pumpWidget(const CustomerApp());

    // 가입
    await tap(tester, find.text('처음이에요 · 가입하기'));
    await waitFor(tester, find.text('다음 · 가게 등록'));
    // 가입 화면의 입력란만 (화면이 넘어가는 동안에는 로그인 화면의 입력란도 함께 잡힌다).
    final fields = find.descendant(
      of: find.byType(SignupScreen),
      matching: find.byType(EditableText),
    );
    await tester.enterText(fields.at(0), '박모보');
    await tester.enterText(fields.at(1), '010-1234-5678');
    await tester.enterText(fields.at(2), email);
    await tester.enterText(fields.at(3), 'password123');
    await tap(tester, find.text('전체 동의'));
    await tap(tester, find.text('다음 · 가게 등록'));

    // 가게가 없으니 등록부터
    await waitFor(tester, find.text('가게를 먼저\n등록해 주세요'));
    await tap(tester, find.text('가게 등록하기'));
    await waitFor(tester, find.text('심사 신청하기'));
    final form = find.byType(EditableText);
    await tester.enterText(form.at(0), '모보치킨 역삼점');
    await tester.enterText(form.at(1), randomBusinessNumber());
    await tester.enterText(form.at(2), '02-555-1234');
    // 서버에 카카오 키가 있으면 실제 검색, 없으면 견본 주소에서 찾는다 — 어느 쪽이든 동은 같다.
    await tap(tester, find.text('가게 주소를 검색해 주세요'));
    await tester.enterText(find.byType(EditableText).last, '테헤란로 152');
    await tap(tester, find.textContaining('역삼동'));
    await tester.enterText(find.byType(EditableText).at(3), '1층');
    await tap(tester, find.text('심사 신청하기'));

    // 승인 전에는 심사 대기 화면만
    await waitFor(tester, find.text('심사하고 있어요'));
    expect(find.text('모보치킨 역삼점'), findsOneWidget);
    await tap(tester, find.text('로그아웃'));
    await tap(tester, find.text('로그아웃').last);
    await waitFor(tester, find.text('가게 계정으로\n로그인해 주세요'));
    expect(await api.auth.isSignedIn(), isFalse);
  });
}
