import 'package:flutter/material.dart';
import 'package:movo_api/movo_api.dart';
import 'package:movo_ui/movo_ui.dart';

import 'settlements_screen.dart';

/// 수입. 기간의 수입을 날짜별 막대로 보고, 다음 정산 금액을 확인한다.
class EarningsScreen extends StatefulWidget {
  const EarningsScreen({super.key, required this.reload});

  final MovoAsyncController reload;

  @override
  State<EarningsScreen> createState() => _EarningsScreenState();
}

class _EarningsScreenState extends State<EarningsScreen> {
  /// 보는 기간(일): 1, 7, 30
  int _days = 7;

  static const _labels = {1: '일', 7: '7일', 30: '월'};

  Future<Earnings> _load() {
    final now = DateTime.now();
    return context.api.dispatch.earnings(
      from: now.subtract(Duration(days: _days - 1)),
      to: now,
    );
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return SafeArea(
      bottom: false,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 12, 20, 0),
            child: Row(
              children: [
                Expanded(child: Text('수입', style: mv(28, 800, ls: -0.03))),
                Container(
                  padding: const EdgeInsets.all(4),
                  decoration: BoxDecoration(
                    color: colors.surface,
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      for (final MapEntry(key: days, value: label)
                          in _labels.entries)
                        Semantics(
                          button: true,
                          selected: days == _days,
                          child: GestureDetector(
                            behavior: HitTestBehavior.opaque,
                            onTap: () {
                              setState(() => _days = days);
                              widget.reload.reload();
                            },
                            child: Container(
                              margin: const EdgeInsets.symmetric(horizontal: 1),
                              padding: const EdgeInsets.symmetric(
                                horizontal: 13,
                                vertical: 7,
                              ),
                              decoration: BoxDecoration(
                                color: days == _days ? colors.text : null,
                                borderRadius: BorderRadius.circular(10),
                              ),
                              child: Text(
                                label,
                                style: days == _days
                                    ? mv(13, 800, color: colors.background)
                                    : mv(13, 700, color: colors.textMuted),
                              ),
                            ),
                          ),
                        ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          Expanded(
            child: MovoAsync<Earnings>(
              controller: widget.reload,
              load: _load,
              builder: (context, earnings) => ListView(
                padding: const EdgeInsets.fromLTRB(20, 20, 20, 24),
                children: [
                  Text(
                    '${switch (_days) {
                      1 => '오늘',
                      7 => '최근 7일',
                      _ => '최근 30일',
                    }} · ${earnings.completedCount}건 완료',
                    style: mv(14, 700, color: colors.textMuted),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    won(earnings.totalSales),
                    style: mv(40, 900, ls: -0.04, tabular: true),
                  ),
                  if (earnings.daily.length > 1) ...[
                    const SizedBox(height: 20),
                    MovoCard(
                      radius: 26,
                      padding: const EdgeInsets.fromLTRB(18, 20, 18, 16),
                      child: _Bars(earnings.daily),
                    ),
                  ],
                  const SizedBox(height: 20),
                  MovoCard(
                    onTap: () => Navigator.of(context).push(
                      MaterialPageRoute<void>(
                        builder: (_) => const SettlementsScreen(),
                      ),
                    ),
                    padding: const EdgeInsets.symmetric(
                      horizontal: 18,
                      vertical: 16,
                    ),
                    child: Row(
                      children: [
                        const MovoIconTile(
                          MovoIcons.wallet,
                          size: 44,
                          iconSize: 22,
                          foreground: MovoPalette.lime,
                        ),
                        const SizedBox(width: 14),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                '다음 정산 · ${_settlementDay(earnings.nextSettlementDate)}',
                                style: mv(13, 700, color: colors.textMuted),
                              ),
                              const SizedBox(height: 3),
                              Text(
                                earnings.nextSettlementAmount > 0
                                    ? '${won(earnings.nextSettlementAmount)} 입금 예정'
                                    : '입금 예정 금액이 없어요',
                                style: mv(17, 800),
                              ),
                            ],
                          ),
                        ),
                        MovoIcon(
                          MovoIcons.chevronRight,
                          size: 18,
                          color: colors.textMuted,
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// 2026-10-16 → 10월 16일 (금)
String _settlementDay(String date) {
  final parsed = DateTime.tryParse(date);
  if (parsed == null) return date;
  return '${parsed.month}월 ${parsed.day}일 (${weekdays[parsed.weekday - 1]})';
}

/// 날짜별 수입 막대. 가장 최근 날(오늘)을 강조한다.
class _Bars extends StatelessWidget {
  const _Bars(this.daily);

  final List<DailyEarnings> daily;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final most = daily.fold(0, (max, day) => day.sales > max ? day.sales : max);
    final labelled = daily.length <= 7;
    final gap = labelled ? 10.0 : 3.0;
    return Column(
      children: [
        SizedBox(
          height: 150,
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              for (final (index, day) in daily.indexed) ...[
                if (index > 0) SizedBox(width: gap),
                Expanded(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.end,
                    children: [
                      if (index == daily.length - 1 &&
                          labelled &&
                          day.sales > 0) ...[
                        Text(
                          shortWon(day.sales),
                          softWrap: false,
                          overflow: TextOverflow.visible,
                          style: mv(11, 800, color: MovoPalette.lime),
                        ),
                        const SizedBox(height: 6),
                      ],
                      Container(
                        // 수입이 없는 날은 바닥에 가는 선만 남긴다.
                        // 가장 긴 막대 위에도 금액 글자(약 22)가 들어갈 자리를 남긴다.
                        height: most == 0 || day.sales == 0
                            ? 4
                            : 8 + 116 * day.sales / most,
                        decoration: BoxDecoration(
                          color: index == daily.length - 1
                              ? MovoPalette.lime
                              : colors.progressOff,
                          borderRadius: BorderRadius.circular(
                            day.sales == 0 ? 2 : (labelled ? 8 : 3),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ],
          ),
        ),
        if (labelled) ...[
          const SizedBox(height: 12),
          Row(
            children: [
              for (final (index, day) in daily.indexed) ...[
                if (index > 0) SizedBox(width: gap),
                Expanded(
                  child: Text(
                    index == daily.length - 1
                        ? '오늘'
                        : weekdays[(DateTime.tryParse(day.date)?.weekday ?? 1) -
                              1],
                    textAlign: TextAlign.center,
                    style: mv(
                      12,
                      700,
                      color: index == daily.length - 1
                          ? colors.text
                          : colors.textMuted,
                    ),
                  ),
                ),
              ],
            ],
          ),
        ],
      ],
    );
  }
}
