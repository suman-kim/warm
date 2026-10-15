import 'package:flutter/material.dart';
import 'package:movo_api/movo_api.dart';
import 'package:movo_ui/movo_ui.dart';

import '../driver_scope.dart';

/// 배송 상세. 배송 내역에서 한 건을 누르면 열린다 — 이 배송으로 받은 금액과 요금 내역,
/// 수수료를 뺀 정산 예정액과 정산 주, 배차부터 완료까지의 진행 시각, 주문 정보.
class TripDetailScreen extends StatelessWidget {
  const TripDetailScreen({super.key, required this.order});

  final Order order;

  Future<(DriverSettlements, ChargeRules)> _load(BuildContext context) async {
    final api = context.api;
    return await (api.dispatch.settlements(), chargeRulesOf(api)).wait;
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    backgroundColor: context.colors.background,
    body: SafeArea(
      bottom: false,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const MovoTopBar(title: '배송 상세'),
          Expanded(
            child: MovoAsync<(DriverSettlements, ChargeRules)>(
              load: () => _load(context),
              builder: (context, data) {
                final (settlements, rules) = data;
                return ListView(
                  padding: EdgeInsets.fromLTRB(
                    16,
                    10,
                    16,
                    MediaQuery.paddingOf(context).bottom + 40,
                  ),
                  children: [
                    _Header(order),
                    const SizedBox(height: 12),
                    _AmountCard(order, settlements: settlements, rules: rules),
                    const SizedBox(height: 12),
                    _TimelineCard(order, rules: rules),
                    const SizedBox(height: 12),
                    _InfoCard(order),
                  ],
                );
              },
            ),
          ),
        ],
      ),
    ),
  );
}

/// 앞으로 남은 단계·화살표처럼 한 단계 더 흐린 글자.
const _dim = Color(0xFF5C5F64);

/// 배송이 끝난 시각 (완료, 취소 또는 노쇼).
DateTime _endedAt(Order order) =>
    order.deliveredAt ??
    order.cancelledAt ??
    order.noShowAt ??
    order.requestedAt;

/// 상태 꼬리표, 끝난 시각, 경로, 차종·거리·운행 시간.
class _Header extends StatelessWidget {
  const _Header(this.order);

  final Order order;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final (label, background, foreground) = switch (order.status) {
      OrderStatus.noShow => (
        '노쇼',
        MovoPalette.dangerNight,
        MovoPalette.dangerOnNight,
      ),
      OrderStatus.cancelled => (
        '고객 취소',
        colors.surfaceMuted,
        colors.textSecondary,
      ),
      _ => ('배송 완료', MovoPalette.lime, MovoPalette.ink),
    };
    final assigned = order.assignedAt, delivered = order.deliveredAt;
    final meta = [
      vehicleLabel(order.vehicleType),
      km(order.distanceKm),
      if (assigned != null && delivered != null)
        '${delivered.difference(assigned).inMinutes}분 운행',
    ].join(' · ');
    return Padding(
      padding: const EdgeInsets.fromLTRB(4, 2, 4, 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              MovoTag(
                label,
                background: background,
                foreground: foreground,
                fontSize: 12,
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                radius: 8,
              ),
              const SizedBox(width: 8),
              Text(
                dayClock(_endedAt(order)),
                style: mv(13, 700, color: colors.textMuted, tabular: true),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(routeTitle(order), style: mv(26, 800, ls: -0.03, height: 1.3)),
          const SizedBox(height: 8),
          Text(meta, style: mv(14, 600, color: colors.textMuted)),
        ],
      ),
    );
  }
}

/// 어두운 카드 하나.
class _Card extends StatelessWidget {
  const _Card({this.title, required this.children});

  final String? title;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(18),
    decoration: BoxDecoration(
      color: context.colors.surface,
      borderRadius: BorderRadius.circular(24),
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (title case final title?) ...[
          Text(title, style: mv(16, 800)),
          const SizedBox(height: 14),
        ],
        for (final (index, child) in children.indexed) ...[
          if (index > 0) const SizedBox(height: 14),
          child,
        ],
      ],
    ),
  );
}

/// 이름과 값 한 줄. 줄 사이는 가는 선.
class _Line {
  const _Line(
    this.label,
    this.value, {
    this.color,
    this.strike = false,
    this.weight = 700,
  });

  final String label;
  final String value;
  final Color? color;
  final bool strike;
  final int weight;
}

class _Lines extends StatelessWidget {
  const _Lines(this.lines, {this.labelColor});

  final List<_Line> lines;
  final Color? labelColor;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Column(
      children: [
        for (final (index, line) in lines.indexed)
          Container(
            padding: const EdgeInsets.symmetric(vertical: 11),
            decoration: index < lines.length - 1
                ? BoxDecoration(
                    border: Border(bottom: BorderSide(color: colors.divider)),
                  )
                : null,
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  line.label,
                  style: mv(14, 600, color: labelColor ?? colors.textMuted),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Text(
                    line.value,
                    textAlign: TextAlign.right,
                    style: mv(
                      14,
                      line.weight,
                      tabular: true,
                      color: line.color ?? colors.text,
                      decoration: line.strike
                          ? TextDecoration.lineThrough
                          : null,
                    ),
                  ),
                ),
              ],
            ),
          ),
      ],
    );
  }
}

/// 받은 금액과 그 내역, 수수료를 뺀 정산 예정액과 들어가는 정산 주.
class _AmountCard extends StatelessWidget {
  const _AmountCard(
    this.order, {
    required this.settlements,
    required this.rules,
  });

  final Order order;
  final DriverSettlements settlements;
  final ChargeRules rules;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final cancelled = order.status == OrderStatus.cancelled;
    final noShow = order.status == OrderStatus.noShow;
    // 배송은 매출(최종 요금)을 받고 수수료를 뗀다. 취소·노쇼는 보상만 받고 수수료가 없다.
    final amount = driverAmountOf(order);
    // 서버가 주는 정산액(earning)을 쓴다. 없으면 서버와 같은 식으로 어림한다 (10원 단위 반올림).
    final net =
        order.earning ??
        (cancelled || noShow
            ? 0
            : amount -
                  (amount * settlements.commissionPercent / 1000).round() * 10);
    final fee = cancelled || noShow ? 0 : amount - net;
    final percent = order.fare == 0
        ? 0
        : (order.cancellationFee * 100 / order.fare).round();
    final waited = order.arrivedAt != null && order.noShowAt != null
        ? order.noShowAt!.difference(order.arrivedAt!).inMinutes
        : null;
    final lines = cancelled || noShow
        ? [
            _Line('요금', won(order.fare), color: colors.textMuted, strike: true),
            if (noShow)
              _Line(
                '노쇼${waited == null ? '' : ' · $waited분 대기'}',
                '고객 요금 $percent%',
                color: MovoPalette.dangerOnNight,
              ),
            _Line(
              cancelled ? '취소 보상' : '노쇼 보상',
              '+${won(net)}',
              color: MovoPalette.lime,
            ),
          ]
        : [
            for (final (index, line) in fareLines(order, rules).indexed)
              _Line(
                line.label,
                line.amountText,
                color: index == 0 ? null : MovoPalette.lime,
              ),
          ];
    return _Card(
      children: [
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              cancelled
                  ? '취소 보상'
                  : noShow
                  ? '노쇼 · 받은 금액'
                  : '이 배송으로 받은 금액',
              style: mv(13, 700, color: colors.textMuted),
            ),
            const SizedBox(height: 4),
            Text(
              won(amount),
              style: mv(
                32,
                900,
                ls: -0.03,
                height: 1.15,
                tabular: true,
                color: MovoPalette.lime,
              ),
            ),
          ],
        ),
        _Lines(lines),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 2),
          decoration: BoxDecoration(
            color: colors.surfaceMuted,
            borderRadius: BorderRadius.circular(16),
          ),
          child: _Lines(labelColor: colors.textFaint, [
            _Line(
              '수수료 ${_percentText(settlements.commissionPercent)}',
              fee == 0 ? '없음' : '−${won(fee)}',
            ),
            _Line('정산 예정', won(net), weight: 800),
          ]),
        ),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 2),
          child: Text(
            _settlementNote(_endedAt(order), settlements),
            style: mv(12, 600, color: colors.textMuted, height: 1.5),
          ),
        ),
      ],
    );
  }
}

/// 10 → 10%, 9.5 → 9.5%
String _percentText(num percent) =>
    '${percent == percent.roundToDouble() ? percent.toInt() : percent}%';

/// 이 배송이 들어가는 정산 주와 지급일. 한 주는 한국 날짜 월~일이고, 그다음 주의 지급 요일에 준다.
String _settlementNote(DateTime endedAt, DriverSettlements settlements) {
  // 한국 날짜를 날짜로만 다룬다 (기기의 시간대와 무관하게).
  final day = DateTime.parse(toKstDate(endedAt));
  final start = day.subtract(Duration(days: day.weekday - 1));
  String two(int value) => value.toString().padLeft(2, '0');
  final weekStart = '${start.year}-${two(start.month)}-${two(start.day)}';
  final week = [
    settlements.current,
    ...settlements.upcoming,
    ...settlements.paid,
  ].where((week) => week.weekStart == weekStart).firstOrNull;
  final payout = week != null
      ? DateTime.parse(week.payoutDate)
      : start.add(Duration(days: 7 + (settlements.payoutWeekday + 6) % 7));
  String dot(DateTime at) => '${at.month}.${at.day}';
  final range = '${dot(start)} ~ ${dot(start.add(const Duration(days: 6)))}';
  final payoutText = '${monthDay(payout)} (${weekday(payout)})';
  if (week?.status == SettlementStatus.paid) {
    return '$range 정산으로 $payoutText에 지급했어요';
  }
  if (week != null && week.weekStart == settlements.current.weekStart) {
    return '이번 주($range) 정산에 들어가요 · $payoutText 지급 예정';
  }
  return '$range 정산에 들어가요 · $payoutText 지급 예정';
}

/// 배차부터 완료(또는 취소·노쇼)까지의 진행 시각.
class _TimelineCard extends StatelessWidget {
  const _TimelineCard(this.order, {required this.rules});

  final Order order;
  final ChargeRules rules;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final arrived = order.arrivedAt, pickedUp = order.pickedUpAt;
    final waiting = arrived != null && pickedUp != null
        ? '대기 ${order.waitingMinutes}분 · ${order.waitingFee > 0 ? '대기료 ${won(order.waitingFee)}' : '${rules.freeWaitingMinutes}분 무료'}'
        : '';
    final extras = order.extraFee > 0
        ? '추가 요금 ${extraItemLabels(order.extraItems).join(' · ')}'
        : '';
    final base = [
      ('배차', order.assignedAt, ''),
      ('출발', order.departedAt, ''),
      ('픽업지 도착', arrived, waiting),
      ('픽업', pickedUp, extras),
      ('배송 완료', order.deliveredAt, ''),
    ];
    final percent = order.fare == 0
        ? 0
        : (order.cancellationFee * 100 / order.fare).round();
    final tail = switch (order.status) {
      OrderStatus.cancelled => (
        '고객 취소',
        order.cancelledAt,
        order.departedAt != null ? '출발 후 취소 · 고객 수수료 $percent%' : '출발 전 취소',
      ),
      OrderStatus.noShow => (
        '노쇼 처리',
        order.noShowAt,
        arrived != null && order.noShowAt != null
            ? '도착 후 ${order.noShowAt!.difference(arrived).inMinutes}분 대기'
            : '',
      ),
      _ => null,
    };
    // 끝까지 간 배송은 다섯 단계를 모두, 취소·노쇼는 지나온 단계와 끝난 사유를 보여준다.
    final steps = tail == null
        ? base
        : [...base.where((step) => step.$2 != null), tail];
    return _Card(
      title: '진행 시각',
      children: [
        Column(
          children: [
            for (final (index, (label, at, sub)) in steps.indexed)
              IntrinsicHeight(
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    SizedBox(
                      width: 12,
                      child: Column(
                        children: [
                          const SizedBox(height: 5),
                          Container(
                            width: 10,
                            height: 10,
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              color: at == null
                                  ? colors.separator
                                  : tail != null && index == steps.length - 1
                                  ? (order.status == OrderStatus.noShow
                                        ? MovoPalette.dangerOnNight
                                        : colors.textSecondary)
                                  : MovoPalette.lime,
                            ),
                          ),
                          if (index < steps.length - 1)
                            Expanded(
                              child: Container(
                                width: 2,
                                margin: const EdgeInsets.symmetric(vertical: 4),
                                color: colors.divider,
                              ),
                            ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: ConstrainedBox(
                        constraints: const BoxConstraints(minHeight: 44),
                        child: Padding(
                          padding: const EdgeInsets.only(bottom: 12),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                label,
                                style: mv(
                                  14,
                                  800,
                                  color: at == null ? _dim : colors.text,
                                ),
                              ),
                              if (sub.isNotEmpty) ...[
                                const SizedBox(height: 2),
                                Text(
                                  sub,
                                  style: mv(12, 600, color: colors.textMuted),
                                ),
                              ],
                            ],
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 14),
                    Text(
                      at == null ? '—' : clock(at),
                      style: mv(
                        14,
                        700,
                        tabular: true,
                        color: at == null ? _dim : colors.text,
                      ),
                    ),
                  ],
                ),
              ),
          ],
        ),
      ],
    );
  }
}

/// 출발·도착 주소와 층, 물품, 운반 도움, 고객(가린 이름), 주문번호.
class _InfoCard extends StatelessWidget {
  const _InfoCard(this.order);

  final Order order;

  /// 1층에 엘리베이터가 있으면 덧붙이지 않는다: · 3층 계단
  static String _floor(FloorAccess access) =>
      access.floor <= 1 && access.elevator
      ? ''
      : ' · ${access.floor}층${access.hasStairs ? ' 계단' : ''}';

  /// 김지은 → 김*은, 이서 → 이*
  static String _mask(String name) => name.length < 2
      ? name
      : '${name.characters.first}*${name.characters.skip(2).join()}';

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return _Card(
      title: '주문 정보',
      children: [
        _Lines([
          _Line(
            '출발',
            shortAddress(order.pickup.address) + _floor(order.pickupAccess),
          ),
          _Line(
            '도착',
            shortAddress(order.dropoff.address) + _floor(order.dropoffAccess),
          ),
          _Line('물품', cargoWithWeight(order.cargo)),
          _Line('운반 도움', loadingHelpLabel(order.loadingHelp)),
          _Line('고객', _mask(order.pickup.contactName)),
          _Line('주문번호', order.code),
        ]),
        Text(
          '배송이 끝나 고객 연락처는 가려져요. 문제가 있으면 고객센터로 알려 주세요.',
          style: mv(12, 600, color: colors.textMuted, height: 1.5),
        ),
      ],
    );
  }
}
