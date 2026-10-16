import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:movo_api/movo_api.dart';
import 'package:movo_ui/movo_ui.dart';

import 'rider_format.dart';

/// 만나서 결제. 손님에게 받은 방식(현금·카드)과 금액을 넣고 배달을 마친다. 마친 배달을 돌려준다.
class CollectScreen extends StatefulWidget {
  const CollectScreen({super.key, required this.order});

  final Order order;

  @override
  State<CollectScreen> createState() => _CollectScreenState();
}

class _CollectScreenState extends State<CollectScreen> {
  late final StoreDelivery _delivery = widget.order.storeDelivery;
  late DoorPayment _method = _delivery.doorPayment;
  late final _amount = TextEditingController(
    text: won(_delivery.foodAmount).replaceAll('원', ''),
  );
  String? _error;
  bool _busy = false;

  @override
  void dispose() {
    _amount.dispose();
    super.dispose();
  }

  int get _value =>
      int.tryParse(_amount.text.replaceAll(RegExp(r'\D'), '')) ?? 0;

  Future<void> _done() async {
    final amount = _value;
    if (amount == 0) {
      setState(() => _error = '손님에게 받은 방식과 금액을 넣어 주세요.');
      return;
    }
    setState(() => _busy = true);
    final api = context.api;
    final navigator = Navigator.of(context);
    final order = await runAction(
      context,
      () => api.dispatch.complete(
        widget.order.id,
        collectedMethod: _method,
        collectedAmount: amount,
      ),
    );
    if (!mounted) return;
    setState(() => _busy = false);
    if (order != null) navigator.pop(order);
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final amount = _value;
    final differs = amount > 0 && amount != _delivery.foodAmount;
    return MovoPage(
      title: '만나서 결제',
      bottom: MovoButton('완료', loading: _busy, onPressed: _done),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text('받을 금액', style: mv(13, 700, color: colors.textMuted)),
          const SizedBox(height: 4),
          Text(
            won(_delivery.foodAmount),
            style: mv(
              40,
              800,
              ls: -0.03,
              tabular: true,
              color: MovoPalette.lime,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            '${destinationLine(widget.order)} · ${payLabel(_delivery.doorPayment)}',
            style: mv(13, 600, color: colors.textSecondary),
          ),
          const SizedBox(height: 24),
          Text('받은 방식', style: mv(14, 800)),
          const SizedBox(height: 10),
          Row(
            children: [
              _MethodTile(
                icon: MovoIcons.cash,
                label: '현금',
                selected: _method == DoorPayment.cash,
                onTap: () => setState(() {
                  _method = DoorPayment.cash;
                  _error = null;
                }),
              ),
              const SizedBox(width: 8),
              _MethodTile(
                icon: MovoIcons.card,
                label: '카드',
                selected: _method == DoorPayment.card,
                onTap: () => setState(() {
                  _method = DoorPayment.card;
                  _error = null;
                }),
              ),
            ],
          ),
          const SizedBox(height: 16),
          MovoField(
            label: '받은 금액',
            controller: _amount,
            keyboardType: TextInputType.number,
            inputFormatters: [_WonFormatter()],
            tabular: true,
            trailing: Text('원', style: mv(16, 800)),
            onChanged: (_) => setState(() => _error = null),
          ),
          if (differs) ...[
            const SizedBox(height: 10),
            Text(
              '음식값 ${won(_delivery.foodAmount)}과 ${won((amount - _delivery.foodAmount).abs())} 달라요. 받은 금액이 맞는지 확인해 주세요.',
              style: mv(13, 700, color: MovoPalette.lime, height: 1.5),
            ),
          ],
          if (_error != null) ...[
            const SizedBox(height: 10),
            Text(_error!, style: mv(13, 700, color: MovoPalette.dangerOnNight)),
          ],
        ],
      ),
    );
  }
}

class _MethodTile extends StatelessWidget {
  const _MethodTile({
    required this.icon,
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final MovoIcons icon;
  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final foreground = selected ? MovoPalette.ink : colors.text;
    return Expanded(
      child: Semantics(
        selected: selected,
        button: true,
        child: Pressable(
          onTap: onTap,
          child: Container(
            height: 84,
            decoration: BoxDecoration(
              color: selected ? MovoPalette.lime : colors.surface,
              borderRadius: BorderRadius.circular(20),
              border: selected
                  ? null
                  : Border.all(color: colors.surfaceMuted, width: 1.5),
            ),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                MovoIcon(icon, size: 22, color: foreground),
                const SizedBox(height: 6),
                Text(label, style: mv(15, 800, color: foreground)),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// 숫자만 받아 23,000처럼 쉼표를 넣는다.
class _WonFormatter extends TextInputFormatter {
  @override
  TextEditingValue formatEditUpdate(
    TextEditingValue oldValue,
    TextEditingValue newValue,
  ) {
    final d = newValue.text.replaceAll(RegExp(r'\D'), '');
    if (d.isEmpty) return const TextEditingValue();
    final digits = d.length > 7 ? d.substring(0, 7) : d;
    final text = won(int.parse(digits)).replaceAll('원', '');
    return TextEditingValue(
      text: text,
      selection: TextSelection.collapsed(offset: text.length),
    );
  }
}
