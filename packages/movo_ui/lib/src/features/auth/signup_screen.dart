import 'package:flutter/material.dart';
import 'package:movo_api/movo_api.dart';

import '../../app/async_view.dart';
import '../../app/profile.dart';
import '../../app/session.dart';
import '../../design/colors.dart';
import '../../design/icons.dart';
import '../../design/widgets.dart';
import '../account/legal_screens.dart';

final _phonePattern = RegExp(r'^01[016789]-?\d{3,4}-?\d{4}$');
final _emailPattern = RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$');

/// 계정을 만드는 화면. 이름·휴대폰·이메일·비밀번호와 약관 동의를 한 화면에서 받는다.
/// 가입하면 바로 로그인된 상태가 된다 (라이더 앱은 이어서 오토바이·서류 단계로 넘어간다).
class SignupScreen extends StatefulWidget {
  const SignupScreen({super.key, required this.profile});

  final MovoAppProfile profile;

  @override
  State<SignupScreen> createState() => _SignupScreenState();
}

class _SignupScreenState extends State<SignupScreen> {
  final _name = TextEditingController();
  final _phone = TextEditingController();
  final _email = TextEditingController();
  final _password = TextEditingController();
  bool _terms = false;
  bool _privacy = false;
  bool _marketing = false;
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    for (final controller in [_name, _phone, _email, _password]) {
      controller.addListener(_changed);
    }
  }

  void _changed() => setState(() {});

  @override
  void dispose() {
    for (final controller in [_name, _phone, _email, _password]) {
      controller.dispose();
    }
    super.dispose();
  }

  bool get _longEnough => _password.text.length >= 8;
  bool get _mixed =>
      RegExp(r'[A-Za-z]').hasMatch(_password.text) &&
      RegExp(r'\d').hasMatch(_password.text);

  /// 아직 채우지 않은 것. 모두 채웠으면 null.
  String? get _missing {
    if (_name.text.trim().isEmpty) return '이름을 입력해 주세요.';
    if (!_phonePattern.hasMatch(_phone.text.trim())) {
      return '휴대폰 번호를 확인해 주세요.';
    }
    if (!_emailPattern.hasMatch(_email.text.trim())) {
      return '이메일 주소를 확인해 주세요.';
    }
    if (!_longEnough || !_mixed) {
      return '비밀번호는 영문과 숫자를 포함해 8자 이상으로 만들어 주세요.';
    }
    if (!_terms || !_privacy) return '필수 약관에 동의해 주세요.';
    return null;
  }

  Future<void> _submit() async {
    final missing = _missing;
    if (missing != null) {
      showMovoToast(context, missing);
      return;
    }
    FocusScope.of(context).unfocus();
    setState(() => _busy = true);
    final session = context.session;
    final navigator = Navigator.of(context);
    final ok = await runAction(context, () async {
      await session.register(
        email: _email.text.trim(),
        password: _password.text,
        name: _name.text.trim(),
        phone: _phone.text.trim(),
        agreements: Agreements(
          terms: _terms,
          privacy: _privacy,
          marketing: _marketing,
        ),
      );
      return true;
    });
    if (!mounted) return;
    setState(() => _busy = false);
    // 로그인된 상태가 됐으니 가입 화면들을 걷어 낸다.
    if (ok == true) navigator.popUntil((route) => route.isFirst);
  }

  void _view(LegalDocumentType type) => Navigator.of(context).push(
    MaterialPageRoute<void>(builder: (_) => LegalDocumentScreen(type: type)),
  );

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final profile = widget.profile;
    final step = profile.signupStep;
    final all = _terms && _privacy && _marketing;
    return MovoPage(
      trailing: step == null
          ? null
          : Padding(
              padding: const EdgeInsets.only(right: 8),
              child: Text(
                '${step.$1} / ${step.$2}',
                style: mv(14, 800, color: colors.textMuted, tabular: true),
              ),
            ),
      padding: const EdgeInsets.fromLTRB(20, 10, 20, 24),
      bottom: MovoButton(
        profile.signupSubmitLabel,
        onPressed: _missing == null || !colors.isDark ? _submit : null,
        loading: _busy,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (step != null) ...[
            MovoSegments(total: step.$2, filled: step.$1, height: 4),
            const SizedBox(height: 22),
          ],
          Text(profile.signupTitle, style: mv(28, 800, ls: -0.035)),
          const SizedBox(height: 8),
          Text(
            profile.signupSubtitle,
            style: mv(15, 600, color: colors.textMuted),
          ),
          const SizedBox(height: 22),
          AutofillGroup(
            child: Column(
              children: [
                MovoField(
                  label: '이름',
                  controller: _name,
                  textInputAction: TextInputAction.next,
                  autofillHints: const [AutofillHints.name],
                  maxLength: 50,
                ),
                const SizedBox(height: 10),
                MovoField(
                  label: '휴대폰 번호',
                  controller: _phone,
                  hint: '010-1234-5678',
                  keyboardType: TextInputType.phone,
                  textInputAction: TextInputAction.next,
                  autofillHints: const [AutofillHints.telephoneNumber],
                  tabular: true,
                ),
                const SizedBox(height: 10),
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
                  revealable: false,
                  textInputAction: TextInputAction.done,
                  autofillHints: const [AutofillHints.newPassword],
                  maxLength: 72,
                ),
              ],
            ),
          ),
          const SizedBox(height: 10),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 4),
            child: Row(
              children: [
                _Rule('8자 이상', met: _longEnough),
                const SizedBox(width: 14),
                _Rule('영문·숫자 포함', met: _mixed),
              ],
            ),
          ),
          const SizedBox(height: 22),
          MovoCard(
            radius: 20,
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
            child: Column(
              children: [
                Pressable(
                  onTap: () => setState(() {
                    _terms = _privacy = _marketing = !all;
                  }),
                  child: Container(
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    decoration: BoxDecoration(
                      border: Border(bottom: BorderSide(color: colors.divider)),
                    ),
                    child: Row(
                      children: [
                        _CheckBox(checked: all),
                        const SizedBox(width: 12),
                        Text('전체 동의', style: mv(15, 800)),
                      ],
                    ),
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 8),
                  child: Column(
                    children: [
                      _Agreement(
                        '[필수] 이용약관 동의',
                        checked: _terms,
                        onChanged: (v) => setState(() => _terms = v),
                        onView: () => _view(LegalDocumentType.terms),
                      ),
                      _Agreement(
                        '[필수] 개인정보 수집·이용 동의',
                        checked: _privacy,
                        onChanged: (v) => setState(() => _privacy = v),
                        onView: () => _view(LegalDocumentType.privacy),
                      ),
                      _Agreement(
                        '[선택] 마케팅 정보 수신 동의',
                        checked: _marketing,
                        onChanged: (v) => setState(() => _marketing = v),
                        onView: () => _view(LegalDocumentType.marketing),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// 비밀번호 조건 하나. 충족하면 강조색으로 바뀐다.
class _Rule extends StatelessWidget {
  const _Rule(this.label, {required this.met});

  final String label;
  final bool met;

  @override
  Widget build(BuildContext context) {
    final color = met ? context.colors.accentText : context.colors.placeholder;
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        MovoIcon(MovoIcons.check, size: 12, color: color),
        const SizedBox(width: 4),
        Text(label, style: mv(12, 700, color: color)),
      ],
    );
  }
}

class _CheckBox extends StatelessWidget {
  const _CheckBox({required this.checked});

  final bool checked;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Container(
      width: 22,
      height: 22,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: checked ? colors.primary : null,
        borderRadius: BorderRadius.circular(7),
        border: checked
            ? null
            : Border.all(color: colors.separator, width: 1.5),
      ),
      child: checked
          ? MovoIcon(MovoIcons.check, size: 12, color: colors.onPrimary)
          : null,
    );
  }
}

class _Agreement extends StatelessWidget {
  const _Agreement(
    this.label, {
    required this.checked,
    required this.onChanged,
    required this.onView,
  });

  final String label;
  final bool checked;
  final ValueChanged<bool> onChanged;
  final VoidCallback onView;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Row(
      children: [
        Expanded(
          child: Semantics(
            checked: checked,
            child: Pressable(
              onTap: () => onChanged(!checked),
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 6),
                child: Row(
                  children: [
                    MovoIcon(
                      MovoIcons.check,
                      size: 16,
                      color: checked ? colors.text : colors.separator,
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        label,
                        style: mv(14, 600, color: colors.textSecondary),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
        Pressable(
          onTap: onView,
          child: Padding(
            padding: const EdgeInsets.only(left: 12, top: 6, bottom: 6),
            child: Text('보기', style: mv(13, 700, color: colors.textMuted)),
          ),
        ),
      ],
    );
  }
}
