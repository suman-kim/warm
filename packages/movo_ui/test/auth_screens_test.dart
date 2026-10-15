import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:movo_api/movo_api.dart';
import 'package:movo_testkit/movo_testkit.dart';
import 'package:movo_ui/movo_ui.dart';

void main() {
  for (final profile in [MovoAppProfile.customer, MovoAppProfile.driver]) {
    final app = profile.role == UserRole.driver ? 'driver' : 'customer';

    testScreen('$app 로그인 화면', (tester) async {
      final backend = FakeBackend();
      await pumpScreen(
        tester,
        api: backend.api(profile.role, signedIn: false),
        profile: profile,
        screen: LoginScreen(profile: profile),
      );

      expect(find.text('로그인'), findsOneWidget);
      expect(find.text(profile.otherAppTitle), findsOneWidget);
      await screenshot(tester, '$app-login');
    });

    testScreen('$app 회원가입 화면', (tester) async {
      final backend = FakeBackend();
      await pumpScreen(
        tester,
        api: backend.api(profile.role, signedIn: false),
        profile: profile,
        screen: SignupScreen(profile: profile),
      );
      await tester.enterText(find.byType(EditableText).at(0), '김지은');
      await tester.enterText(find.byType(EditableText).at(1), '010-1234-5678');
      await tester.enterText(
        find.byType(EditableText).at(2),
        'jieun.kim@gmail.com',
      );
      await tester.enterText(find.byType(EditableText).at(3), 'password12');
      await tester.tap(find.text('전체 동의'));
      await settle(tester);

      expect(find.text(profile.signupSubmitLabel), findsOneWidget);
      await screenshot(tester, '$app-signup');
    });
  }
}
