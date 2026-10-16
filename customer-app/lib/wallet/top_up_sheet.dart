import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:movo_api/movo_api.dart';
import 'package:movo_ui/movo_ui.dart';

/// 충전 방식.
enum TopUpMethod { virtualAccount, card }

/// 충전하기 시트. 금액과 방식을 고르면 충전하고, 충전했으면 완료 화면을 거쳐 true를 돌려준다.
///
/// 아직 포트원 가상계좌·카드 충전을 붙이지 않아서, 개발 서버는 고른 방식과 상관없이 바로 충전한다.
/// 운영 서버는 충전을 거절하고 그 이유를 알린다.
Future<bool> showTopUpSheet(BuildContext context) async {
  final navigator = Navigator.of(context);
  final entry = await showModalBottomSheet<WalletEntry>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    barrierColor: context.colors.scrim,
    builder: (_) => const _TopUpSheet(),
  );
  if (entry == null) return false;
  await navigator.push(
    MaterialPageRoute<void>(builder: (_) => TopUpDoneScreen(entry: entry)),
  );
  return true;
}

class _TopUpSheet extends StatefulWidget {
  const _TopUpSheet();

  @override
  State<_TopUpSheet> createState() => _TopUpSheetState();
}

class _TopUpSheetState extends State<_TopUpSheet> {
  static const _min = 10000;
  static const _max = 2000000;
  static const _quick = [50000, 100000, 300000];

  final _amount = TextEditingController();
  TopUpMethod _method = TopUpMethod.virtualAccount;
  bool _error = false;
  bool _busy = false;

  @override
  void dispose() {
    _amount.dispose();
    super.dispose();
  }

  int get _value =>
      int.tryParse(_amount.text.replaceAll(RegExp(r'\D'), '')) ?? 0;

  void _set(int amount) {
    final text = won(amount).replaceAll('원', '');
    _amount.value = TextEditingValue(
      text: text,
      selection: TextSelection.collapsed(offset: text.length),
    );
    setState(() => _error = false);
  }

  Future<void> _submit() async {
    final amount = _value;
    if (amount < _min || amount > _max) {
      setState(() => _error = true);
      return;
    }
    setState(() => _busy = true);
    final navigator = Navigator.of(context);
    final api = context.api;
    try {
      final entry = await api.stores.topUp(amount);
      navigator.pop(entry);
    } on Object catch (error) {
      if (!mounted) return;
      setState(() => _busy = false);
      showMovoToast(context, errorMessage(error));
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final amount = _value;
    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
      child: Container(
        padding: EdgeInsets.fromLTRB(
          20,
          12,
          20,
          MediaQuery.paddingOf(context).bottom + 20,
        ),
        decoration: BoxDecoration(
          color: colors.surface,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(30)),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const MovoSheetHandle(),
            const SizedBox(height: 20),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 4),
              child: Text('충전하기', style: mv(20, 800, ls: -0.02)),
            ),
            const SizedBox(height: 14),
            Container(
              padding: const EdgeInsets.fromLTRB(6, 0, 6, 8),
              decoration: BoxDecoration(
                border: Border(
                  bottom: BorderSide(
                    color: _error ? MovoPalette.danger : colors.text,
                    width: 2,
                  ),
                ),
              ),
              child: Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: _amount,
                      autofocus: true,
                      keyboardType: TextInputType.number,
                      inputFormatters: [_WonFormatter()],
                      onChanged: (_) => setState(() => _error = false),
                      style: mv(30, 800, ls: -0.03, tabular: true),
                      decoration: InputDecoration(
                        isCollapsed: true,
                        border: InputBorder.none,
                        hintText: '0',
                        hintStyle: mv(30, 800, color: colors.placeholder),
                      ),
                    ),
                  ),
                  Text('원', style: mv(20, 800)),
                ],
              ),
            ),
            const SizedBox(height: 16),
            Row(
              children: [
                for (final (index, value) in _quick.indexed) ...[
                  if (index > 0) const SizedBox(width: 8),
                  Expanded(
                    child: MovoChip(
                      '${value ~/ 10000}만원',
                      selected: amount == value,
                      height: 42,
                      outlined: false,
                      background: colors.surfaceSunken,
                      onTap: () => _set(value),
                    ),
                  ),
                ],
              ],
            ),
            const SizedBox(height: 14),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 4),
              child: Text(
                '10,000원부터 2,000,000원까지 충전할 수 있어요',
                style: mv(
                  13,
                  _error ? 700 : 600,
                  color: _error ? MovoPalette.danger : colors.textMuted,
                ),
              ),
            ),
            const SizedBox(height: 18),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 4),
              child: Text('충전 방식', style: mv(14, 800)),
            ),
            const SizedBox(height: 10),
            _MethodCard(
              title: '가상계좌 입금',
              body: '계좌번호를 받아 입금하면 자동으로 충전돼요',
              selected: _method == TopUpMethod.virtualAccount,
              onTap: () => setState(() => _method = TopUpMethod.virtualAccount),
            ),
            const SizedBox(height: 8),
            _MethodCard(
              title: '카드 충전',
              body: '카드로 바로 충전해요 · 카드는 저장하지 않아요',
              selected: _method == TopUpMethod.card,
              onTap: () => setState(() => _method = TopUpMethod.card),
            ),
            const SizedBox(height: 20),
            MovoButton(
              amount > 0 ? '${won(amount)} 충전하기' : '충전하기',
              loading: _busy,
              onPressed: _submit,
            ),
          ],
        ),
      ),
    );
  }
}

class _MethodCard extends StatelessWidget {
  const _MethodCard({
    required this.title,
    required this.body,
    required this.selected,
    required this.onTap,
  });

  final String title;
  final String body;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Pressable(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        decoration: BoxDecoration(
          color: selected ? colors.surface : colors.background,
          borderRadius: BorderRadius.circular(16),
          border: selected ? Border.all(color: colors.text, width: 2) : null,
        ),
        child: Row(
          children: [
            Container(
              width: 22,
              height: 22,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                border: Border.all(
                  color: selected ? colors.text : colors.separator,
                  width: selected ? 6.5 : 1.5,
                ),
              ),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title, style: mv(15, 800)),
                  const SizedBox(height: 2),
                  Text(body, style: mv(12, 600, color: colors.textMuted)),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// 충전 완료.
class TopUpDoneScreen extends StatelessWidget {
  const TopUpDoneScreen({super.key, required this.entry});

  final WalletEntry entry;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return MovoPage(
      bottom: MovoButton('확인', onPressed: () => Navigator.of(context).pop()),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const SizedBox(height: 24),
          const Align(
            alignment: Alignment.centerLeft,
            child: MovoIconTile(
              MovoIcons.check,
              size: 68,
              radius: 22,
              iconSize: 28,
              background: MovoPalette.lime,
              foreground: MovoPalette.ink,
            ),
          ),
          const SizedBox(height: 22),
          Text('충전했어요', style: mv(28, 800, ls: -0.03)),
          const SizedBox(height: 8),
          Text(
            '${won(entry.amount)}이 충전금에 들어왔어요',
            style: mv(14, 600, color: colors.textMuted),
          ),
          const SizedBox(height: 24),
          MovoCard(
            radius: 24,
            padding: const EdgeInsets.fromLTRB(18, 6, 18, 6),
            child: Column(
              children: [
                MovoKeyValue('충전한 금액', won(entry.amount), tabular: true),
                MovoKeyValue(
                  '지금 잔액',
                  won(entry.balanceAfter),
                  tabular: true,
                  strong: true,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// 숫자만 받아 100,000처럼 쉼표를 넣는다.
class _WonFormatter extends TextInputFormatter {
  @override
  TextEditingValue formatEditUpdate(
    TextEditingValue oldValue,
    TextEditingValue newValue,
  ) {
    final d = newValue.text.replaceAll(RegExp(r'\D'), '');
    if (d.isEmpty) return const TextEditingValue();
    final digits = d.length > 8 ? d.substring(0, 8) : d;
    final text = won(int.parse(digits)).replaceAll('원', '');
    return TextEditingValue(
      text: text,
      selection: TextSelection.collapsed(offset: text.length),
    );
  }
}
