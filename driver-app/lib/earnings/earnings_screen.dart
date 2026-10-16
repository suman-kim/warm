import 'package:flutter/material.dart';
import 'package:movo_api/movo_api.dart';
import 'package:movo_ui/movo_ui.dart';

typedef _EarningsData = ({
  DailyEarnings? today,
  int cashToday,
  DriverSettlements settlements,
});

/// 수입. 오늘 수입과 만나서 받은 현금, 이번 주 수입, 주별 정산 내역.
class EarningsScreen extends StatelessWidget {
  const EarningsScreen({super.key, required this.reload});

  final MovoAsyncController reload;

  Future<_EarningsData> _load(BuildContext context) async {
    final api = context.api;
    final now = DateTime.now();
    final (earnings, settlements, orders) = await (
      api.dispatch.earnings(from: now, to: now),
      api.dispatch.settlements(),
      api.dispatch.myOrders(
        from: now,
        to: now,
        status: OrderStatus.delivered,
        size: 100,
      ),
    ).wait;
    final cash = orders.items.fold(0, (sum, order) {
      final delivery = order.storeDelivery;
      return delivery.collectedMethod == DoorPayment.cash
          ? sum + (delivery.collectedAmount ?? 0)
          : sum;
    });
    return (
      today: earnings.daily.lastOrNull,
      cashToday: cash,
      settlements: settlements,
    );
  }

  @override
  Widget build(BuildContext context) => SafeArea(
    bottom: false,
    child: MovoAsync<_EarningsData>(
      controller: reload,
      load: () => _load(context),
      builder: (context, data) {
        final colors = context.colors;
        final today = data.today;
        final settlements = data.settlements;
        final current = settlements.current;
        final percent = settlements.commissionPercent;
        final weeks = [current, ...settlements.upcoming, ...settlements.paid];
        return ListView(
          padding: const EdgeInsets.fromLTRB(20, 12, 20, 24),
          children: [
            Text('수입', style: mv(28, 800, ls: -0.03)),
            const SizedBox(height: 18),
            MovoCard(
              radius: 24,
              padding: const EdgeInsets.all(18),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text('오늘 수입', style: mv(13, 700, color: colors.textMuted)),
                  const SizedBox(height: 6),
                  Text(
                    won(today?.earnings ?? 0),
                    style: mv(
                      34,
                      800,
                      ls: -0.03,
                      tabular: true,
                      color: MovoPalette.lime,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    '${today?.completedCount ?? 0}건 · 대행료 '
                    '${won(today?.sales ?? 0)}에서 수수료 '
                    '${_percent(percent)}%를 뺐어요',
                    style: mv(13, 600, color: colors.textSecondary),
                  ),
                  const SizedBox(height: 14),
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 14,
                      vertical: 14,
                    ),
                    decoration: BoxDecoration(
                      color: colors.surfaceMuted,
                      borderRadius: BorderRadius.circular(14),
                    ),
                    child: Row(
                      children: [
                        Expanded(
                          child: Text(
                            '만나서 받은 현금',
                            style: mv(14, 700, color: colors.textSecondary),
                          ),
                        ),
                        Text(
                          won(data.cashToday),
                          style: mv(15, 800, tabular: true),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 12),
            MovoCard(
              radius: 24,
              padding: const EdgeInsets.all(18),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text('이번 주', style: mv(13, 700, color: colors.textMuted)),
                  const SizedBox(height: 6),
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Expanded(
                        child: Text(
                          won(current.net),
                          style: mv(24, 800, ls: -0.02, tabular: true),
                        ),
                      ),
                      Text(
                        '${_range(current)} · ${current.trips}건',
                        style: mv(
                          12,
                          600,
                          color: colors.textMuted,
                          tabular: true,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: 22),
            Text('정산 내역', style: mv(15, 800)),
            const SizedBox(height: 10),
            MovoRows(
              radius: 22,
              padding: const EdgeInsets.symmetric(horizontal: 16),
              children: [
                for (final week in weeks)
                  _WeekRow(week, current: identical(week, current)),
              ],
            ),
            if (settlements.onHold) ...[
              const SizedBox(height: 12),
              Text(
                '정산 계좌가 없거나 본인 명의로 확인되지 않아 정산이 보류돼요. 마이에서 계좌를 확인해 주세요.',
                style: mv(
                  12,
                  700,
                  color: MovoPalette.dangerOnNight,
                  height: 1.5,
                ),
              ),
            ],
          ],
        );
      },
    ),
  );
}

String _percent(num value) =>
    value == value.roundToDouble() ? '${value.toInt()}' : '$value';

/// 2026-10-12 → 10.12
String _md(String date) {
  final parts = date.split('-');
  return parts.length == 3 ? '${parts[1]}.${parts[2]}' : date;
}

String _range(SettlementWeek week) =>
    '${_md(week.weekStart)} – ${_md(week.weekEnd)}';

/// 10월 2주 정산 (주의 시작일이 그달 몇째 주인지)
String _weekTitle(SettlementWeek week) {
  final start = DateTime.tryParse(week.weekStart);
  if (start == null) return '정산';
  return '${start.month}월 ${(start.day - 1) ~/ 7 + 1}주 정산';
}

/// 10월 20일 (화)
String _payoutLabel(String date) {
  final at = DateTime.tryParse(date);
  return at == null ? date : '${monthDay(at)} (${weekday(at)})';
}

class _WeekRow extends StatelessWidget {
  const _WeekRow(this.week, {required this.current});

  final SettlementWeek week;
  final bool current;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final paid = week.status == SettlementStatus.paid;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 14),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  current ? '이번 주 정산' : _weekTitle(week),
                  style: mv(15, 800),
                ),
                const SizedBox(height: 3),
                Text(
                  paid
                      ? '${_range(week)} · ${week.trips}건'
                      : '${_range(week)} · ${_payoutLabel(week.payoutDate)} 지급 예정',
                  style: mv(12, 600, color: colors.textMuted, tabular: true),
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(won(week.net), style: mv(16, 800, tabular: true)),
              const SizedBox(height: 4),
              MovoTag(
                paid ? '지급 완료' : '지급 예정',
                background: paid ? colors.surfaceMuted : MovoPalette.lime,
                foreground: paid ? const Color(0xFFC9CBCF) : MovoPalette.ink,
                fontSize: 11,
                padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
                radius: 7,
              ),
            ],
          ),
        ],
      ),
    );
  }
}
