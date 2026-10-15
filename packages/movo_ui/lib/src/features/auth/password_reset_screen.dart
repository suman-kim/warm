import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../app/async_view.dart';
import '../../app/session.dart';
import '../../design/colors.dart';
import '../../design/widgets.dart';

/// 비밀번호 찾기. 이메일로 6자리 코드를 받고, 코드와 새 비밀번호를 보낸다.
class PasswordResetScreen extends StatefulWidget {
  const PasswordResetScreen({super.key, this.initialEmail = ''});

  final String initialEmail;

  @override
  State<PasswordResetScreen> createState() => _PasswordResetScreenState();
}

class _PasswordResetScreenState extends State<PasswordResetScreen> {
  late final _email = TextEditingController(text: widget.initialEmail.trim());
  final _code = TextEditingController();
  final _password = TextEditingController();

  /// 코드를 보낸 뒤면 true — 코드와 새 비밀번호를 받는 단계다.
  bool _sent = false;
  bool _busy = false;

  @override
  void dispose() {
    _email.dispose();
    _code.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _request() async {
    final email = _email.text.trim();
    if (!email.contains('@')) {
      showMovoToast(context, '가입한 이메일 주소를 입력해 주세요.');
      return;
    }
    FocusScope.of(context).unfocus();
    setState(() => _busy = true);
    final api = context.api;
    final ok = await runAction(context, () async {
      await api.auth.requestPasswordReset(email: email);
      return true;
    });
    if (!mounted) return;
    setState(() {
      _busy = false;
      _sent = ok == true || _sent;
    });
  }

  Future<void> _confirm() async {
    if (_code.text.length != 6) {
      showMovoToast(context, '메일로 받은 6자리 코드를 입력해 주세요.');
      return;
    }
    FocusScope.of(context).unfocus();
    setState(() => _busy = true);
    final api = context.api;
    final navigator = Navigator.of(context);
    final ok = await runAction(context, () async {
      await api.auth.confirmPasswordReset(
        email: _email.text.trim(),
        code: _code.text,
        newPassword: _password.text,
      );
      return true;
    });
    if (!mounted) return;
    setState(() => _busy = false);
    if (ok == true) {
      showMovoToast(context, '비밀번호를 바꿨어요. 새 비밀번호로 로그인해 주세요.');
      navigator.pop();
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return MovoPage(
      padding: const EdgeInsets.fromLTRB(20, 10, 20, 24),
      bottom: MovoButton(
        _sent ? '비밀번호 바꾸기' : '인증 코드 받기',
        onPressed: _sent ? _confirm : _request,
        loading: _busy,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text('비밀번호 찾기', style: mv(28, 800, ls: -0.035)),
          const SizedBox(height: 8),
          Text(
            _sent
                ? '메일로 보낸 6자리 코드와 새 비밀번호를 입력해 주세요. 코드는 10분 동안 쓸 수 있어요.'
                : '가입한 이메일로 인증 코드를 보내드려요',
            style: mv(15, 600, color: colors.textMuted, height: 1.5),
          ),
          const SizedBox(height: 22),
          MovoField(
            label: '이메일',
            controller: _email,
            enabled: !_sent,
            keyboardType: TextInputType.emailAddress,
            textInputAction: TextInputAction.done,
            autofillHints: const [AutofillHints.email],
            onSubmitted: (_) => _sent ? null : _request(),
          ),
          if (_sent) ...[
            const SizedBox(height: 10),
            MovoField(
              label: '인증 코드',
              controller: _code,
              hint: '6자리 숫자',
              keyboardType: TextInputType.number,
              textInputAction: TextInputAction.next,
              inputFormatters: [FilteringTextInputFormatter.digitsOnly],
              maxLength: 6,
              tabular: true,
              autofocus: true,
            ),
            const SizedBox(height: 10),
            MovoField(
              label: '새 비밀번호',
              controller: _password,
              hint: '영문·숫자 포함 8자 이상',
              obscure: true,
              textInputAction: TextInputAction.done,
              maxLength: 72,
              onSubmitted: (_) => _confirm(),
            ),
            const SizedBox(height: 14),
            Align(
              alignment: Alignment.centerLeft,
              child: Pressable(
                onTap: _busy ? null : _request,
                child: Padding(
                  padding: const EdgeInsets.all(4),
                  child: Text(
                    '코드 다시 받기',
                    style: mv(13, 700, color: colors.textMuted),
                  ),
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}
