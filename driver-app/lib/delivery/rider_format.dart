import 'package:flutter/material.dart';
import 'package:movo_api/movo_api.dart';
import 'package:movo_ui/movo_ui.dart';

/// 동시에 맡을 수 있는 배달 수.
const maxActiveDeliveries = 3;

/// 주문번호 끝 4자리 — 가게에 말하는 번호 (MV261015-3F9A → 3F9A).
String shortCode(Order order) => order.code.length >= 4
    ? order.code.substring(order.code.length - 4)
    : order.code;

/// 가게 이름 (픽업지의 연락처 이름이 가게 이름이다).
String storeNameOf(Order order) => order.pickup.contactName;

/// 동 (없으면 시·군·구까지 줄인 주소).
String dongOf(Waypoint waypoint) => waypoint.dong?.isNotEmpty ?? false
    ? waypoint.dong!
    : areaShort(waypoint.sigungu ?? waypoint.address);

/// 배달지 한 줄: 역삼동 · 101동 1203호
String destinationLine(Order order) => [
  dongOf(order.dropoff),
  if (order.dropoff.detailAddress?.isNotEmpty ?? false)
    order.dropoff.detailAddress!,
].join(' · ');

/// 서울 강남구 역삼로 180 → 역삼로 180
String roadOnly(String address) {
  final parts = address.trim().split(RegExp(r'\s+'));
  return parts.length > 2 ? parts.sublist(parts.length - 2).join(' ') : address;
}

String payLabel(DoorPayment? payment) => switch (payment) {
  DoorPayment.cash => '만나서 현금',
  DoorPayment.card => '만나서 카드',
  _ => '선결제',
};

/// 받을 돈 한 줄: 만나서 현금 · 23,000원 받아요 / 선결제 · 받을 돈이 없어요
String collectLine(DoorPayment? payment, int foodAmount) =>
    payment?.collectsAtDoor ?? false
    ? '${payLabel(payment)} · ${won(foodAmount)} 받아요'
    : '선결제 · 받을 돈이 없어요';

/// 받은 돈: 현금 23,000원
String collectedText(StoreDelivery delivery) =>
    '${delivery.collectedMethod == DoorPayment.card ? '카드' : '현금'} '
    '${won(delivery.collectedAmount ?? 0)}';

/// 오후 7:45
String ampm(DateTime at) {
  final local = at.toLocal();
  final hour = local.hour % 12 == 0 ? 12 : local.hour % 12;
  final minute = local.minute.toString().padLeft(2, '0');
  return '${local.hour < 12 ? '오전' : '오후'} $hour:$minute';
}

/// 조리가 끝나는 때까지: 14분 뒤 픽업 / 바로 픽업
String readyText(DateTime? readyAt, {DateTime? now}) {
  if (readyAt == null) return '바로 픽업';
  final left = readyAt.difference(now ?? DateTime.now()).inSeconds;
  final minutes = (left / 60).ceil();
  return minutes <= 0 ? '바로 픽업' : '$minutes분 뒤 픽업';
}

/// 수수료 (요금 − 라이더 몫).
int commissionOf(int fare, int earning) => fare - earning;

/// 수수료율(%) — 요금과 라이더 몫에서 거꾸로 구한다.
int commissionPercentOf(int fare, int earning) =>
    fare == 0 ? 0 : ((fare - earning) * 100 / fare).round();

/// 진행 단계의 이름과 다음에 할 일.
(String, String) stageOf(OrderStatus status) => switch (status) {
  OrderStatus.arrived => ('가게 도착', '음식을 받으면 [픽업 완료]를 눌러 주세요'),
  OrderStatus.pickedUp => ('손님에게 이동', '전하고 나면 [전달 완료]를 눌러 주세요'),
  _ => ('가게로 이동', '가게에 도착하면 [가게 도착]을 눌러 주세요'),
};

/// 다음에 이어 갈 배달의 순서: 배달 중 → 가게 도착 → 가게로 이동.
int nextPriority(OrderStatus status) => switch (status) {
  OrderStatus.pickedUp => 0,
  OrderStatus.arrived => 1,
  _ => 2,
};

/// 받을 돈 꼬리표 (콜 목록·배달 진행).
class PayBadge extends StatelessWidget {
  const PayBadge({
    super.key,
    required this.payment,
    required this.foodAmount,
    this.long = false,
  });

  final DoorPayment? payment;
  final int foodAmount;

  /// '· 23,000원 받아요'까지 길게 쓸지.
  final bool long;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final collects = payment?.collectsAtDoor ?? false;
    final cash = payment == DoorPayment.cash;
    final background = !collects
        ? colors.surfaceMuted
        : cash || long
        ? MovoPalette.lime
        : const Color(0xFFF2F2EE);
    final foreground = collects ? MovoPalette.ink : const Color(0xFFC9CBCF);
    return Container(
      padding: EdgeInsets.symmetric(horizontal: 12, vertical: long ? 13 : 7),
      decoration: BoxDecoration(
        color: background,
        borderRadius: BorderRadius.circular(long ? 16 : 10),
      ),
      child: Row(
        mainAxisSize: long ? MainAxisSize.max : MainAxisSize.min,
        children: [
          MovoIcon(
            !collects
                ? MovoIcons.check
                : cash
                ? MovoIcons.cash
                : MovoIcons.card,
            size: !collects ? 12 : 16,
            color: foreground,
          ),
          const SizedBox(width: 7),
          Flexible(
            child: Text(
              long
                  ? collectLine(payment, foodAmount)
                  : collects
                  ? '${payLabel(payment)} ${won(foodAmount)}'
                  : '선결제',
              style: mv(long ? 15 : 13, 800, color: foreground, tabular: true),
            ),
          ),
        ],
      ),
    );
  }
}
