import 'package:flutter/material.dart';
import 'package:movo_api/movo_api.dart';

import '../../app/async_view.dart';
import '../../app/format.dart';
import '../../app/profile.dart';
import '../../app/session.dart';
import '../../design/colors.dart';
import '../../design/icons.dart';
import '../../design/widgets.dart';
import 'password_reset_screen.dart';
import 'signup_screen.dart';
import 'wrong_app_screen.dart';

/// 로그인 화면. 두 앱이 함께 쓰고, 문구와 색만 다르다.
class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key, required this.profile});

  final MovoAppProfile profile;

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _email = TextEditingController();
  final _password = TextEditingController();
  bool _busy = false;

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _login() async {
    final email = _email.text.trim();
    final password = _password.text;
    if (email.isEmpty || password.isEmpty) {
      showMovoToast(context, '이메일과 비밀번호를 입력해 주세요.');
      return;
    }
    FocusScope.of(context).unfocus();
    setState(() => _busy = true);
    try {
      await context.session.login(email: email, password: password);
    } on WrongAppException {
      if (!mounted) return;
      _password.clear();
      await Navigator.of(context).push(
        MaterialPageRoute<void>(
          builder: (_) => WrongAppScreen(profile: widget.profile, email: email),
        ),
      );
    } on Object catch (error) {
      if (mounted) showMovoToast(context, errorMessage(error));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  void _open(Widget screen) => Navigator.of(
    context,
  ).push(MaterialPageRoute<void>(builder: (_) => screen));

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final profile = widget.profile;
    return Scaffold(
      backgroundColor: colors.background,
      body: SafeArea(
        bottom: false,
        child: CustomScrollView(
          slivers: [
            SliverFillRemaining(
              hasScrollBody: false,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Padding(
                    padding: const EdgeInsets.fromLTRB(24, 62, 24, 0),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Align(
                          alignment: Alignment.centerLeft,
                          child: MovoLogo(size: 36, badge: profile.logoBadge),
                        ),
                        const SizedBox(height: 20),
                        Text(
                          profile.loginTitle,
                          style: mv(28, 800, ls: -0.035, height: 1.3),
                        ),
                        const SizedBox(height: 8),
                        Text(
                          profile.loginSubtitle,
                          style: mv(15, 600, color: colors.textMuted),
                        ),
                        const SizedBox(height: 32),
                        AutofillGroup(
                          child: Column(
                            children: [
                              MovoField(
                                label: '이메일',
                                controller: _email,
                                keyboardType: TextInputType.emailAddress,
                                textInputAction: TextInputAction.next,
                                autofillHints: const [AutofillHints.email],
                              ),
                              const SizedBox(height: 10),
                              MovoField(
                                label: '비밀번호',
                                controller: _password,
                                obscure: true,
                                textInputAction: TextInputAction.done,
                                autofillHints: const [AutofillHints.password],
                                onSubmitted: (_) => _login(),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 32),
                        MovoButton('로그인', onPressed: _login, loading: _busy),
                        const SizedBox(height: 18),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Pressable(
                              onTap: () => _open(
                                PasswordResetScreen(initialEmail: _email.text),
                              ),
                              child: Text(
                                '비밀번호 찾기',
                                style: mv(14, 700, color: colors.textSecondary),
                              ),
                            ),
                            Container(
                              width: 1,
                              height: 12,
                              margin: const EdgeInsets.symmetric(
                                horizontal: 14,
                              ),
                              color: colors.separator,
                            ),
                            Pressable(
                              onTap: () =>
                                  _open(SignupScreen(profile: profile)),
                              child: Text(
                                profile.signupLabel,
                                style: mv(14, 800, color: colors.text),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                  const Spacer(),
                  MovoBottomBar(child: _OtherAppTile(profile: profile)),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// 다른 앱을 쓰는 사람을 위한 안내 (라이더님이신가요?).
class _OtherAppTile extends StatelessWidget {
  const _OtherAppTile({required this.profile});

  final MovoAppProfile profile;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Pressable(
      onTap: () =>
          showMovoToast(context, '${profile.otherAppName}을 설치해 로그인해 주세요.'),
      child: Container(
        margin: const EdgeInsets.only(top: 16),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        decoration: BoxDecoration(
          color: colors.isDark ? colors.surface : colors.surfaceMuted,
          borderRadius: BorderRadius.circular(18),
        ),
        child: Row(
          children: [
            MovoIconTile(
              profile.otherAppIcon,
              size: 40,
              radius: 12,
              iconSize: 20,
              background: colors.isDark ? colors.surfaceMuted : MovoPalette.ink,
              foreground: colors.isDark ? colors.text : MovoPalette.lime,
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(profile.otherAppTitle, style: mv(14, 800)),
                  const SizedBox(height: 2),
                  Text(
                    profile.otherAppBody,
                    style: mv(13, 600, color: colors.textMuted),
                  ),
                ],
              ),
            ),
            MovoIcon(MovoIcons.chevronRight, size: 18, color: colors.textMuted),
          ],
        ),
      ),
    );
  }
}
