import 'package:flutter/widgets.dart';

import '../design/colors.dart';
import 'package:movo_api/movo_api.dart';

import 'format.dart';
import 'session.dart';

// 요금 내역을 화면에 보여주는 도구. 고객 앱과 기사 앱이 같은 줄을 쓴다.

/// 요금 내역의 한 줄 (기본 요금 · 다마스 28,000원 / 운반 도움 · 함께 +10,000원).
class FareLine {
  const FareLine(this.label, this.amount, {this.addition = true});

  final String label;
  final int amount;

  /// 기본 요금에 더해지는 항목이면 금액 앞에 +를 붙인다.
  final bool addition;

  String get amountText => addition ? '+${won(amount)}' : won(amount);
}

String loadingHelpLabel(LoadingHelp help) => switch (help) {
  LoadingHelp.none => '없음',
  LoadingHelp.together => '함께',
  LoadingHelp.driverOnly => '기사 혼자',
  LoadingHelp.unknown => '운반 도움',
};

String cardTypeLabel(CardType type) => switch (type) {
  CardType.credit => '신용카드',
  CardType.check => '체크카드',
  CardType.unknown => '카드',
};

/// 계단 요금이 붙은 곳 (도착 3층 / 출발 2층 · 도착 3층).
String stairsLabel(FloorAccess pickup, FloorAccess dropoff) => [
  if (pickup.hasStairs) '출발 ${pickup.floor}층',
  if (dropoff.hasStairs) '도착 ${dropoff.floor}층',
].join(' · ');

/// 기사가 넣은 추가 요금 항목 (과적 1단계 · 큰 짐 운반 1개 · 계단 2층).
List<String> extraItemLabels(ExtraItems items) => [
  if (items.overload > 0) '과적 ${items.overload}단계',
  if (items.bulky > 0) '큰 짐 운반 ${items.bulky}개',
  if (items.stairs > 0) '계단 ${items.stairs}층',
];

/// 배차 때 결제하는 요금의 내역: 기본 요금, 운반 도움, 계단.
List<FareLine> dispatchFareLines(Order order) => [
  FareLine(
    '기본 요금 · ${vehicleLabel(order.vehicleType)}',
    order.baseFare,
    addition: false,
  ),
  if (order.helpFee > 0)
    FareLine('운반 도움 · ${loadingHelpLabel(order.loadingHelp)}', order.helpFee),
  if (order.stairFee > 0)
    FareLine(
      '계단 · ${stairsLabel(order.pickupAccess, order.dropoffAccess)}',
      order.stairFee,
    ),
];

/// 픽업 때 붙은 추가 요금과 대기료의 내역. 단가를 모르면([rules]가 null) 추가 요금을 한 줄로 쓴다.
List<FareLine> additionalFareLines(Order order, ChargeRules? rules) {
  final items = order.extraItems;
  return [
    if (order.extraFee > 0 && rules != null) ...[
      if (items.overload > 0)
        FareLine(
          '추가 · 과적 ${items.overload}단계',
          items.overload * rules.overloadUnitPrice,
        ),
      if (items.bulky > 0)
        FareLine(
          '추가 · 큰 짐 운반 ${items.bulky}개',
          items.bulky * rules.bulkyUnitPrice,
        ),
      if (items.stairs > 0)
        FareLine(
          '추가 · 계단 ${items.stairs}층',
          items.stairs * rules.stairsUnitPrice,
        ),
    ] else if (order.extraFee > 0)
      FareLine('추가 · ${extraItemLabels(items).join(' · ')}', order.extraFee),
    if (order.waitingFee > 0)
      FareLine('대기료 · ${order.waitingMinutes}분 대기', order.waitingFee),
  ];
}

/// 최종 요금의 내역 (배차 때 요금 + 추가 요금 + 대기료).
List<FareLine> fareLines(Order order, ChargeRules? rules) => [
  ...dispatchFareLines(order),
  ...additionalFareLines(order, rules),
];

final _rulesByApi = Expando<Future<ChargeRules>>('chargeRules');

/// 요금 규칙. 서버에서 한 번만 받아 앱이 끝날 때까지 쓴다 (실패하면 다음에 다시 받는다).
Future<ChargeRules> chargeRulesOf(MovoApi api) {
  final cached = _rulesByApi[api];
  if (cached != null) return cached;
  final loading = api.orders.chargeRules();
  _rulesByApi[api] = loading;
  loading.then<void>((_) {}, onError: (Object _) => _rulesByApi[api] = null);
  return loading;
}

/// 요금 규칙을 받아 그린다. 받기 전이거나 받지 못했으면 [builder]에 null이 간다.
class WithChargeRules extends StatefulWidget {
  const WithChargeRules({super.key, required this.builder});

  final Widget Function(BuildContext context, ChargeRules? rules) builder;

  @override
  State<WithChargeRules> createState() => _WithChargeRulesState();
}

class _WithChargeRulesState extends State<WithChargeRules> {
  ChargeRules? _rules;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_rules != null) return;
    chargeRulesOf(context.api).then((rules) {
      if (mounted) setState(() => _rules = rules);
    }, onError: (Object _) {});
  }

  @override
  Widget build(BuildContext context) => widget.builder(context, _rules);
}

/// 대기 시간 막대: 기다린 시간만큼 라임으로 채우고, 무료 시간이 끝나는 곳에 금을 긋는다.
class WaitingBar extends StatelessWidget {
  const WaitingBar({
    super.key,
    required this.minutes,
    required this.free,
    required this.limit,
    required this.track,
    this.marker = const Color(0xFFF7F6F2),
  });

  /// 기다린 시간(분, 소수 포함)
  final double minutes;

  /// 무료로 기다리는 시간(분)
  final int free;

  /// 막대 끝 — 노쇼를 신고할 수 있게 되는 시간(분)
  final int limit;
  final Color track;
  final Color marker;

  @override
  Widget build(BuildContext context) => LayoutBuilder(
    builder: (context, constraints) {
      final width = constraints.maxWidth;
      double at(double minute) => width * (minute / limit).clamp(0, 1);
      return SizedBox(
        height: 6,
        child: Stack(
          children: [
            Positioned.fill(
              child: DecoratedBox(
                decoration: BoxDecoration(
                  color: track,
                  borderRadius: BorderRadius.circular(3),
                ),
              ),
            ),
            Positioned(
              left: 0,
              top: 0,
              bottom: 0,
              width: at(minutes),
              child: DecoratedBox(
                decoration: BoxDecoration(
                  color: MovoPalette.lime,
                  borderRadius: BorderRadius.circular(3),
                ),
              ),
            ),
            Positioned(
              left: at(free.toDouble()) - 1,
              top: 0,
              bottom: 0,
              width: 2,
              child: ColoredBox(color: marker),
            ),
          ],
        ),
      );
    },
  );
}
