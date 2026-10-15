import 'package:flutter/material.dart';
import 'package:movo_api/movo_api.dart';
import 'package:movo_ui/movo_ui.dart';

/// 추가 요금 넣기. 과적·큰 짐 운반·계단을 수량으로 넣으면 금액이 계산된다.
/// 픽업 완료를 밀 때 대기료와 함께 고객 카드로 결제된다. 넣은 수량을 돌려준다.
class ExtrasScreen extends StatefulWidget {
  const ExtrasScreen({super.key, required this.order, required this.initial});

  final Order order;
  final ExtraItems initial;

  @override
  State<ExtrasScreen> createState() => _ExtrasScreenState();
}

class _ExtrasScreenState extends State<ExtrasScreen> {
  late int _overload = widget.initial.overload;
  late int _bulky = widget.initial.bulky;
  late int _stairs = widget.initial.stairs;

  static const _max = 30;

  ExtraItems get _items =>
      ExtraItems(overload: _overload, bulky: _bulky, stairs: _stairs);

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final order = widget.order;
    return WithChargeRules(
      builder: (context, rules) {
        final total = rules == null
            ? 0
            : _overload * rules.overloadUnitPrice +
                  _bulky * rules.bulkyUnitPrice +
                  _stairs * rules.stairsUnitPrice;
        final chosen = [
          if (order.helpFee > 0)
            '운반 도움 · ${loadingHelpLabel(order.loadingHelp)} ${won(order.helpFee)}',
          if (order.stairFee > 0)
            '계단 · ${stairsLabel(order.pickupAccess, order.dropoffAccess)} ${won(order.stairFee)}',
        ];
        return MovoPage(
          title: '추가 요금 넣기',
          bottom: MovoButton(
            total == 0 ? '추가 요금 없음' : '${won(total)} 넣기',
            onPressed: () => Navigator.of(context).pop(_items),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Container(
                padding: const EdgeInsets.fromLTRB(16, 14, 16, 14),
                decoration: BoxDecoration(
                  color: colors.surface,
                  borderRadius: BorderRadius.circular(18),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      '고객이 요청할 때 고른 항목 · 이미 결제됨',
                      style: mv(12, 700, color: colors.textMuted),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      chosen.isEmpty ? '고른 항목이 없어요' : chosen.join(' · '),
                      style: mv(14, 800, height: 1.45),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 18),
              Text(
                '실제와 다른 항목만 넣어 주세요',
                style: mv(13, 700, color: colors.textMuted),
              ),
              const SizedBox(height: 10),
              MovoRows(
                radius: 18,
                padding: const EdgeInsets.symmetric(
                  horizontal: 16,
                  vertical: 2,
                ),
                children: [
                  _CountRow(
                    title: '과적',
                    hint:
                        '기준 무게 초과 · ${rules == null ? '' : '${won(rules.overloadUnitPrice)}/단계'}',
                    value: '$_overload단계',
                    onMinus: _overload > 0
                        ? () => setState(() => _overload--)
                        : null,
                    onPlus: _overload < _max
                        ? () => setState(() => _overload++)
                        : null,
                  ),
                  _CountRow(
                    title: '큰 짐 운반',
                    hint:
                        '부피 큰 짐 1개 · ${rules == null ? '' : '${won(rules.bulkyUnitPrice)}/개'}',
                    value: '$_bulky개',
                    onMinus: _bulky > 0 ? () => setState(() => _bulky--) : null,
                    onPlus: _bulky < _max
                        ? () => setState(() => _bulky++)
                        : null,
                  ),
                  _CountRow(
                    title: '계단',
                    hint:
                        '엘리베이터 없이 오른 층 · ${rules == null ? '' : '${won(rules.stairsUnitPrice)}/층'}',
                    value: '$_stairs층',
                    onMinus: _stairs > 0
                        ? () => setState(() => _stairs--)
                        : null,
                    onPlus: _stairs < _max
                        ? () => setState(() => _stairs++)
                        : null,
                  ),
                ],
              ),
              const SizedBox(height: 18),
              Row(
                children: [
                  Expanded(child: Text('추가 요금', style: mv(16, 800))),
                  Text(
                    won(total),
                    style: mv(24, 900, color: MovoPalette.lime, tabular: true),
                  ),
                ],
              ),
              const SizedBox(height: 10),
              Text(
                '픽업 완료를 밀면 대기료와 함께 고객 카드로 결제되고, 고객에게 내역이 알림으로 가요.',
                style: mv(13, 600, color: colors.textMuted, height: 1.5),
              ),
            ],
          ),
        );
      },
    );
  }
}

class _CountRow extends StatelessWidget {
  const _CountRow({
    required this.title,
    required this.hint,
    required this.value,
    required this.onMinus,
    required this.onPlus,
  });

  final String title;
  final String hint;
  final String value;
  final VoidCallback? onMinus;
  final VoidCallback? onPlus;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 14),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: mv(16, 800)),
                const SizedBox(height: 2),
                Text(hint, style: mv(12, 600, color: colors.textMuted)),
              ],
            ),
          ),
          _Step(minus: true, onTap: onMinus),
          SizedBox(
            width: 56,
            child: Text(
              value,
              textAlign: TextAlign.center,
              style: mv(15, 800, tabular: true),
            ),
          ),
          _Step(minus: false, onTap: onPlus),
        ],
      ),
    );
  }
}

class _Step extends StatelessWidget {
  const _Step({required this.minus, required this.onTap});

  final bool minus;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final color = minus ? colors.text : MovoPalette.ink;
    Widget bar(double width, double height) =>
        Container(width: width, height: height, color: color);
    return Semantics(
      button: true,
      label: minus ? '줄이기' : '늘리기',
      excludeSemantics: true,
      child: Pressable(
        onTap: onTap,
        child: Opacity(
          opacity: onTap == null ? 0.35 : 1,
          child: Container(
            width: 36,
            height: 36,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: minus ? colors.surfaceMuted : MovoPalette.lime,
              shape: BoxShape.circle,
            ),
            child: Stack(
              alignment: Alignment.center,
              children: [bar(12, 2.4), if (!minus) bar(2.4, 12)],
            ),
          ),
        ),
      ),
    );
  }
}

/// 노쇼 신고 확인. 도착하고 기다린 시간과 고객이 낸 요금을 보여 주고 한 번 더 묻는다.
Future<bool> confirmNoShow(BuildContext context, Order order) async {
  final arrived = order.arrivedAt;
  final waited = arrived == null
      ? null
      : DateTime.now().difference(arrived).inMinutes;
  final result = await showModalBottomSheet<bool>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    barrierColor: context.colors.scrim,
    builder: (context) {
      final colors = context.colors;
      return Container(
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
            Text('노쇼로 처리할까요?', style: mv(22, 800, ls: -0.02)),
            const SizedBox(height: 8),
            Text(
              '고객에게 전화와 문자로 연락했는지 확인해 주세요. 노쇼로 처리하면 고객이 낸 요금은 환불되지 않아요.',
              style: mv(14, 500, color: colors.textMuted, height: 1.55),
            ),
            const SizedBox(height: 16),
            MovoRows(
              radius: 18,
              color: colors.surfaceMuted,
              dividerColor: colors.separator,
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 2),
              children: [
                if (arrived != null) MovoKeyValue('도착', clock(arrived)),
                if (waited != null) MovoKeyValue('기다린 시간', '$waited분'),
                MovoKeyValue(
                  '고객 결제 금액',
                  '${won(order.fare)} · 100%',
                  tabular: true,
                ),
              ],
            ),
            const SizedBox(height: 16),
            Row(
              children: [
                Expanded(
                  flex: 2,
                  child: MovoButton(
                    '돌아가기',
                    kind: MovoButtonKind.surface,
                    background: colors.surfaceMuted,
                    height: 56,
                    fontSize: 16,
                    onPressed: () => Navigator.of(context).pop(false),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  flex: 3,
                  child: MovoButton(
                    '노쇼로 처리',
                    height: 56,
                    fontSize: 16,
                    background: MovoPalette.dangerOnNight,
                    foreground: MovoPalette.ink,
                    onPressed: () => Navigator.of(context).pop(true),
                  ),
                ),
              ],
            ),
          ],
        ),
      );
    },
  );
  return result ?? false;
}

/// 진행 중에 고객이 주문을 취소했다. 취소 보상이 있으면 함께 알린다.
class CustomerCancelledScreen extends StatelessWidget {
  const CustomerCancelledScreen({super.key, required this.order});

  final Order order;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final compensation = order.earning ?? 0;
    return Scaffold(
      backgroundColor: colors.background,
      body: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.fromLTRB(20, 90, 20, 24),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    MovoIconTile(
                      MovoIcons.close,
                      size: 72,
                      radius: 22,
                      iconSize: 30,
                      background: colors.surface,
                    ),
                    const SizedBox(height: 24),
                    Text(
                      '고객이 주문을\n취소했어요',
                      style: mv(28, 800, ls: -0.03, height: 1.3),
                    ),
                    const SizedBox(height: 10),
                    Text(
                      compensation > 0
                          ? '기사님이 출발한 뒤 취소돼 ${won(compensation)}을 취소 보상으로 드려요.'
                          : '이 배송은 더 진행하지 않아도 돼요.',
                      style: mv(14, 500, color: colors.textMuted, height: 1.6),
                    ),
                    const SizedBox(height: 24),
                    MovoRows(
                      children: [
                        MovoKeyValue('경로', routeTitle(order)),
                        Padding(
                          padding: const EdgeInsets.symmetric(vertical: 12),
                          child: Row(
                            children: [
                              Expanded(
                                child: Text(
                                  '요금',
                                  style: mv(14, 600, color: colors.textMuted),
                                ),
                              ),
                              Text(
                                won(order.fare),
                                style: mv(
                                  14,
                                  700,
                                  color: colors.textMuted,
                                  tabular: true,
                                  decoration: TextDecoration.lineThrough,
                                ),
                              ),
                            ],
                          ),
                        ),
                        if (compensation > 0)
                          MovoKeyValue('취소 보상', '+${won(compensation)}'),
                      ],
                    ),
                  ],
                ),
              ),
            ),
            MovoBottomBar(
              child: MovoButton(
                '콜 목록으로',
                onPressed: () => Navigator.of(context).pop(),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// 노쇼로 처리했다.
class NoShowDoneScreen extends StatelessWidget {
  const NoShowDoneScreen({super.key, required this.order});

  final Order order;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final compensation = order.earning ?? 0;
    final arrived = order.arrivedAt;
    final noShow = order.noShowAt;
    return Scaffold(
      backgroundColor: colors.background,
      body: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.fromLTRB(20, 90, 20, 24),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    MovoIconTile(
                      MovoIcons.clock,
                      size: 72,
                      radius: 22,
                      iconSize: 30,
                      background: colors.surface,
                      foreground: MovoPalette.dangerOnNight,
                    ),
                    const SizedBox(height: 24),
                    Text('노쇼로 처리했어요', style: mv(28, 800, ls: -0.03)),
                    const SizedBox(height: 10),
                    Text(
                      compensation > 0
                          ? '고객이 낸 요금 중 ${won(compensation)}을 보상으로 드려요.'
                          : '고객에게 노쇼 안내가 갔어요. 다음 콜을 받아 주세요.',
                      style: mv(14, 500, color: colors.textMuted, height: 1.6),
                    ),
                    const SizedBox(height: 24),
                    MovoRows(
                      children: [
                        MovoKeyValue('경로', routeTitle(order)),
                        if (arrived != null) MovoKeyValue('도착', clock(arrived)),
                        if (arrived != null && noShow != null)
                          MovoKeyValue(
                            '기다린 시간',
                            '${noShow.difference(arrived).inMinutes}분',
                          ),
                        if (compensation > 0)
                          MovoKeyValue('노쇼 보상', '+${won(compensation)}'),
                      ],
                    ),
                  ],
                ),
              ),
            ),
            MovoBottomBar(
              child: MovoButton(
                '콜 목록으로',
                onPressed: () => Navigator.of(context).pop(),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
