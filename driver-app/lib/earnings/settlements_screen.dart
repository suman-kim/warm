import 'package:flutter/material.dart';
import 'package:movo_api/movo_api.dart';
import 'package:movo_ui/movo_ui.dart';

import '../my/my_screen.dart';

/// 정산 내역. 이번 주(진행 중), 지급 예정, 지급 완료로 나눠 주별 정산을 보여준다.
/// 계좌 본인인증이 안 되면 위에 안내가 뜨고 정산이 보류된다.
class SettlementsScreen extends StatefulWidget {
  const SettlementsScreen({super.key});

  @override
  State<SettlementsScreen> createState() => _SettlementsScreenState();
}

class _SettlementsScreenState extends State<SettlementsScreen> {
  final _reload = MovoAsyncController();

  @override
  void dispose() {
    _reload.dispose();
    super.dispose();
  }

  Future<void> _openAccount() async {
    await Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => const AccountVerificationScreen(),
      ),
    );
    _reload.reload();
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return MovoPage(
      title: '정산 내역',
      child: MovoAsync<DriverSettlements>(
        controller: _reload,
        load: context.api.dispatch.settlements,
        builder: (context, data) {
          final current = data.current;
          return Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              if (data.onHold) ...[
                Pressable(
                  onTap: _openAccount,
                  child: Container(
                    padding: const EdgeInsets.fromLTRB(16, 14, 12, 14),
                    decoration: BoxDecoration(
                      color: MovoPalette.dangerNight,
                      borderRadius: BorderRadius.circular(18),
                    ),
                    child: Row(
                      children: [
                        const MovoIcon(
                          MovoIcons.alert,
                          size: 18,
                          color: MovoPalette.dangerOnNight,
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                data.account == null
                                    ? '정산 계좌를 등록해 주세요'
                                    : '정산 계좌 인증이 필요해요',
                                style: mv(
                                  15,
                                  800,
                                  color: MovoPalette.dangerOnNight,
                                ),
                              ),
                              const SizedBox(height: 2),
                              Text('인증 전까지 정산금 지급이 보류돼요', style: mv(12, 600)),
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
                ),
                const SizedBox(height: 10),
              ],
              MovoCard(
                padding: const EdgeInsets.fromLTRB(18, 16, 18, 18),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      '이번 주 · ${_range(current)} · 진행 중',
                      style: mv(12, 700, color: colors.textMuted),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      won(current.net),
                      style: mv(30, 900, ls: -0.03, tabular: true),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      '${_payDay(current.payoutDate)} 지급 예정 · 수수료 ${_percent(data.commissionPercent)}%를 뺀 금액이에요',
                      style: mv(12, 600, color: colors.textMuted),
                    ),
                  ],
                ),
              ),
              if (data.upcoming.isNotEmpty) ...[
                const SizedBox(height: 20),
                Text('지급 예정', style: mv(13, 800, color: colors.textMuted)),
                const SizedBox(height: 10),
                for (final week in data.upcoming) ...[
                  _WeekCard(
                    week,
                    commissionPercent: data.commissionPercent,
                    detailed: true,
                  ),
                  const SizedBox(height: 10),
                ],
              ],
              if (data.paid.isNotEmpty) ...[
                const SizedBox(height: 10),
                Text('지급 완료', style: mv(13, 800, color: colors.textMuted)),
                const SizedBox(height: 10),
                for (final week in data.paid) ...[
                  _WeekCard(week, commissionPercent: data.commissionPercent),
                  const SizedBox(height: 10),
                ],
              ],
            ],
          );
        },
      ),
    );
  }
}

String _percent(num value) =>
    value == value.roundToDouble() ? '${value.toInt()}' : '$value';

/// 10.05 – 10.11
String _range(SettlementWeek week) =>
    '${week.weekStart.substring(5).replaceAll('-', '.')} – ${week.weekEnd.substring(5).replaceAll('-', '.')}';

/// 2026-10-20 → 10월 20일 (화)
String _payDay(String date) {
  final parsed = DateTime.tryParse(date);
  if (parsed == null) return date;
  return '${parsed.month}월 ${parsed.day}일 (${weekdays[parsed.weekday - 1]})';
}

/// 2026-10-05 → 10월 2주
String _weekName(String weekStart) {
  final start = DateTime.tryParse(weekStart);
  if (start == null) return weekStart;
  // 그 주의 목요일이 속한 달의 몇 번째 주
  final thursday = start.add(const Duration(days: 3));
  return '${thursday.month}월 ${(thursday.day - 1) ~/ 7 + 1}주';
}

class _WeekCard extends StatelessWidget {
  const _WeekCard(
    this.week, {
    required this.commissionPercent,
    this.detailed = false,
  });

  final SettlementWeek week;
  final num commissionPercent;
  final bool detailed;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final today = DateTime.now();
    final payDay = DateTime.tryParse(week.payoutDate);
    final dueToday = payDay != null && sameDay(payDay, today);
    final (tag, tagBg, tagFg) = switch (week.status) {
      SettlementStatus.paid => (
        '지급 완료',
        colors.surfaceMuted,
        colors.textSecondary,
      ),
      SettlementStatus.hold => (
        '보류',
        MovoPalette.dangerNight,
        MovoPalette.dangerOnNight,
      ),
      SettlementStatus.failed => (
        '지급 실패',
        MovoPalette.dangerNight,
        MovoPalette.dangerOnNight,
      ),
      SettlementStatus.paying => ('지급 중', MovoPalette.lime, MovoPalette.ink),
      _ when dueToday => ('오늘 지급', MovoPalette.lime, MovoPalette.ink),
      _ => ('지급 예정', colors.surfaceMuted, colors.textSecondary),
    };
    final sub = switch (week.status) {
      SettlementStatus.paid when week.paidAt != null =>
        '${_range(week)} · ${_payDay(kstDateOf(week.paidAt!))} 지급',
      SettlementStatus.hold => '${_range(week)} · 계좌 인증 후 지급',
      SettlementStatus.failed =>
        '${_range(week)} · ${week.reason ?? '다시 지급돼요'}',
      _ when dueToday => '${_range(week)} · 오늘 지급 예정',
      _ => '${_range(week)} · ${_payDay(week.payoutDate)} 지급 예정',
    };
    Widget line(String label, String value) => Padding(
      padding: const EdgeInsets.symmetric(vertical: 10),
      child: Row(
        children: [
          Expanded(
            child: Text(label, style: mv(14, 600, color: colors.textMuted)),
          ),
          Text(value, style: mv(14, 700, tabular: true)),
        ],
      ),
    );
    return MovoCard(
      padding: const EdgeInsets.fromLTRB(18, 16, 18, 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(_weekName(week.weekStart), style: mv(16, 800)),
                    const SizedBox(height: 2),
                    Text(sub, style: mv(12, 600, color: colors.textMuted)),
                  ],
                ),
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(won(week.net), style: mv(17, 900, tabular: true)),
                  const SizedBox(height: 4),
                  MovoTag(
                    tag,
                    background: tagBg,
                    foreground: tagFg,
                    fontSize: 11,
                    padding: const EdgeInsets.symmetric(
                      horizontal: 7,
                      vertical: 3,
                    ),
                    radius: 7,
                  ),
                ],
              ),
            ],
          ),
          const SizedBox(height: 8),
          if (detailed) ...[
            Divider(height: 1, color: colors.divider),
            line('운행', '${week.trips}건'),
            line('운행 매출', won(week.gross)),
            line('그중 추가 요금', won(week.extraFare)),
            line('수수료 ${_percent(commissionPercent)}%', '−${won(week.fee)}'),
            line(
              '취소·노쇼 보상',
              week.compensation == 0 ? '0원' : '+${won(week.compensation)}',
            ),
            line('정산액', won(week.net)),
            if (week.bankName != null)
              line(
                '지급 계좌',
                '${week.bankName} ${week.maskedAccountNumber?.replaceAll('••••', '••') ?? ''}',
              ),
          ],
        ],
      ),
    );
  }
}

/// 그 시각이 속한 한국 날짜 (YYYY-MM-DD).
String kstDateOf(DateTime at) =>
    at.toUtc().add(const Duration(hours: 9)).toIso8601String().substring(0, 10);
