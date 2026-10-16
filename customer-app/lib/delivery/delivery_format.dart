import 'package:flutter/material.dart';
import 'package:movo_api/movo_api.dart';
import 'package:movo_ui/movo_ui.dart';

/// 주문번호 끝 4자리 — 라이더가 가게에서 말하는 번호 (MV261015-3F9A → 3F9A).
String shortCode(Order order) => order.code.length >= 4
    ? order.code.substring(order.code.length - 4)
    : order.code;

/// 오후 7:45
String ampm(DateTime at) {
  final local = at.toLocal();
  final hour = local.hour % 12 == 0 ? 12 : local.hour % 12;
  final minute = local.minute.toString().padLeft(2, '0');
  return '${local.hour < 12 ? '오전' : '오후'} $hour:$minute';
}

/// 서울 강남구 봉은사로 524 → 봉은사로 524
String roadOnly(String address) {
  final parts = address.trim().split(RegExp(r'\s+'));
  return parts.length > 2 ? parts.sublist(parts.length - 2).join(' ') : address;
}

/// 손님 동 (없으면 도로명)
String customerArea(Order order) => order.dropoff.dong?.isNotEmpty ?? false
    ? order.dropoff.dong!
    : roadOnly(order.dropoff.address);

String doorPaymentLabel(DoorPayment? payment) => switch (payment) {
  DoorPayment.cash => '만나서 현금',
  DoorPayment.card => '만나서 카드',
  _ => '선결제',
};

/// 받은 방식 (현금·카드)
String collectedLabel(DoorPayment? method) =>
    method == DoorPayment.card ? '카드' : '현금';

/// 진행 단계: 0 요청 · 1 배정 · 2 가게 도착 · 3 픽업 · 4 완료
int stageOf(OrderStatus status) => switch (status) {
  OrderStatus.requested => 0,
  OrderStatus.assigned || OrderStatus.departed => 1,
  OrderStatus.arrived => 2,
  OrderStatus.pickedUp => 3,
  OrderStatus.delivered => 4,
  _ => 0,
};

/// 아직 끝나지 않은 배달인지.
bool isActive(OrderStatus status) => switch (status) {
  OrderStatus.delivered ||
  OrderStatus.cancelled ||
  OrderStatus.unknown => false,
  _ => true,
};

/// 가게가 아직 취소할 수 있는지 (픽업 전).
bool isCancellable(OrderStatus status) => switch (status) {
  OrderStatus.requested ||
  OrderStatus.assigned ||
  OrderStatus.departed ||
  OrderStatus.arrived => true,
  _ => false,
};

/// 상태 꼬리표: 이름과 색.
({String label, Color background, Color foreground}) statusChip(
  BuildContext context,
  OrderStatus status,
) {
  final colors = context.colors;
  return switch (status) {
    OrderStatus.requested => (
      label: '라이더 찾는 중',
      background: MovoPalette.lime,
      foreground: MovoPalette.ink,
    ),
    OrderStatus.assigned || OrderStatus.departed => (
      label: '가게로 오는 중',
      background: MovoPalette.ink,
      foreground: MovoPalette.white,
    ),
    OrderStatus.arrived => (
      label: '라이더 가게 도착',
      background: MovoPalette.ink,
      foreground: MovoPalette.lime,
    ),
    OrderStatus.pickedUp => (
      label: '배달 중',
      background: colors.surfaceMuted,
      foreground: colors.text,
    ),
    OrderStatus.delivered => (
      label: '배달 완료',
      background: colors.surfaceSunken,
      foreground: colors.textSecondary,
    ),
    _ => (
      label: '취소됨',
      background: MovoPalette.dangerSoft,
      foreground: MovoPalette.danger,
    ),
  };
}

/// 상태 꼬리표. [small]은 목록 오른쪽에 붙는 작은 꼬리표.
class StatusChip extends StatelessWidget {
  const StatusChip(this.status, {super.key, this.small = false});

  final OrderStatus status;
  final bool small;

  @override
  Widget build(BuildContext context) {
    final chip = statusChip(context, status);
    return MovoTag(
      chip.label,
      background: chip.background,
      foreground: chip.foreground,
      fontSize: small ? 11 : 12,
      padding: small
          ? const EdgeInsets.symmetric(horizontal: 7, vertical: 3)
          : const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
      radius: small ? 7 : 8,
    );
  }
}

/// 돈 받는 방식 한 줄: 선결제 / 만나서 현금 23,000원
String paymentLine(StoreDelivery delivery) =>
    delivery.doorPayment.collectsAtDoor
    ? '${doorPaymentLabel(delivery.doorPayment)} ${won(delivery.foodAmount)}'
    : doorPaymentLabel(delivery.doorPayment);

/// 픽업 예정 시각: 가게가 정한 조리 완료 시각, 없으면 서버 어림.
DateTime? pickupEta(Order order) =>
    order.pickedUpAt ?? order.estimatedPickupAt ?? order.storeDelivery.readyAt;

/// 목록 오른쪽 위 한 줄 (요청 3분째 / 픽업 예정 오후 7:28 / 도착 예정 오후 7:52).
String progressNote(Order order, DateTime now) {
  switch (order.status) {
    case OrderStatus.requested:
      final minutes = now.difference(order.requestedAt).inMinutes;
      return '요청 ${minutes < 0 ? 0 : minutes}분째';
    case OrderStatus.pickedUp:
      final eta = order.estimatedDeliveryAt;
      return eta == null ? '배달 중' : '도착 예정 ${ampm(eta)}';
    default:
      final eta = pickupEta(order);
      return eta == null ? '가게로 오는 중' : '픽업 예정 ${ampm(eta)}';
  }
}

/// 오늘 · 10월 15일 (목) / 어제 · 10월 14일 (수) / 10월 9일 (금)
String dayLabel(DateTime at) => '${dayHeading(at)} (${weekday(at)})';

/// 날짜별로 묶는다 (들어온 순서를 지킨다).
List<(DateTime, List<T>)> groupByDay<T>(
  List<T> items,
  DateTime Function(T item) dateOf,
) {
  final groups = <(DateTime, List<T>)>[];
  for (final item in items) {
    final at = dateOf(item);
    if (groups.isNotEmpty && sameDay(groups.last.$1, at)) {
      groups.last.$2.add(item);
    } else {
      groups.add((at, [item]));
    }
  }
  return groups;
}
