import 'package:flutter/material.dart';
import 'package:movo_api/movo_api.dart';
import 'package:movo_ui/movo_ui.dart';

import '../order/order_screen.dart';

/// 이용 내역. 진행 중인 주문과 지난 주문을 한곳에서 본다. 취소한 주문도 함께 보인다.
class HistoryScreen extends StatefulWidget {
  const HistoryScreen({super.key, this.controller, required this.onRequest});

  final MovoAsyncController? controller;

  /// 목록이 비었을 때 '첫 배송 요청하기'를 누르면.
  final VoidCallback onRequest;

  @override
  State<HistoryScreen> createState() => _HistoryScreenState();
}

class _HistoryScreenState extends State<HistoryScreen> {
  ServiceType? _filter;
  late final _reload = widget.controller ?? MovoAsyncController();

  static const _filters = <ServiceType?, String>{
    null: '전체',
    ServiceType.quick: '퀵 배송',
    ServiceType.freight: '화물 운송',
  };

  @override
  void dispose() {
    if (widget.controller == null) _reload.dispose();
    super.dispose();
  }

  Future<void> _open(Order order) async {
    await Navigator.of(context).push(
      MaterialPageRoute<void>(builder: (_) => OrderScreen(orderId: order.id)),
    );
    _reload.reload();
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
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('이용 내역', style: mv(28, 800, ls: -0.03)),
                const SizedBox(height: 18),
                Row(
                  children: [
                    for (final MapEntry(key: type, value: label)
                        in _filters.entries) ...[
                      MovoChip(
                        label,
                        selected: _filter == type,
                        height: 35,
                        radius: 16,
                        horizontalPadding: 15,
                        outlined: false,
                        onTap: () {
                          setState(() => _filter = type);
                          _reload.reload();
                        },
                      ),
                      const SizedBox(width: 8),
                    ],
                  ],
                ),
              ],
            ),
          ),
          Expanded(
            child: MovoAsync<Paged<Order>>(
              controller: _reload,
              load: () =>
                  context.api.orders.list(serviceType: _filter, size: 50),
              builder: (context, page) {
                if (page.items.isEmpty) {
                  return MovoStateView(
                    icon: MovoIcons.box,
                    title: '아직 주문이 없어요',
                    body: '보낸 배송은 여기에 모여요',
                    actionLabel: '첫 배송 요청하기',
                    onAction: widget.onRequest,
                    compact: true,
                  );
                }
                final active = [
                  for (final order in page.items)
                    if (order.status == OrderStatus.requested ||
                        order.status == OrderStatus.paying ||
                        order.isInProgress)
                      order,
                ];
                final past = [
                  for (final order in page.items)
                    if (!active.contains(order)) order,
                ];
                return ListView(
                  padding: const EdgeInsets.fromLTRB(20, 18, 20, 24),
                  children: [
                    if (active.isNotEmpty) ...[
                      Text('진행 중', style: mv(14, 800)),
                      const SizedBox(height: 10),
                      for (final order in active) ...[
                        _ActiveCard(order, onTap: () => _open(order)),
                        const SizedBox(height: 10),
                      ],
                      const SizedBox(height: 8),
                    ],
                    if (past.isNotEmpty) ...[
                      Text('지난 배송', style: mv(14, 800)),
                      const SizedBox(height: 10),
                      MovoRows(
                        radius: 24,
                        padding: const EdgeInsets.symmetric(
                          horizontal: 16,
                          vertical: 4,
                        ),
                        children: [
                          for (final order in past)
                            _PastRow(order, onTap: () => _open(order)),
                        ],
                      ),
                    ],
                    if (page.hasMore) ...[
                      const SizedBox(height: 14),
                      Text(
                        '최근 50건까지 보여드려요',
                        textAlign: TextAlign.center,
                        style: mv(12, 600, color: colors.placeholder),
                      ),
                    ],
                  ],
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

/// 진행 중인 주문 카드 (잉크색).
class _ActiveCard extends StatelessWidget {
  const _ActiveCard(this.order, {required this.onTap});

  final Order order;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final (label, note, filled) = switch (order.status) {
      OrderStatus.requested ||
      OrderStatus.paying => ('배차 요청 중', '기사님을 찾고 있어요', 0),
      OrderStatus.assigned => ('배차 완료', '기사님이 곧 출발해요', 1),
      OrderStatus.departed => (
        '기사 출발',
        order.estimatedPickupAt == null
            ? '픽업지로 오고 있어요'
            : '${clock(order.estimatedPickupAt!)} 도착 예정',
        1,
      ),
      OrderStatus.arrived => ('픽업지 도착', '물품을 전해 주세요', 1),
      _ => (
        '배송 중',
        order.estimatedDeliveryAt == null
            ? '이동 중'
            : '${clock(order.estimatedDeliveryAt!)} 도착 예정',
        2,
      ),
    };
    return Pressable(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(18),
        decoration: BoxDecoration(
          color: MovoPalette.ink,
          borderRadius: BorderRadius.circular(24),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const MovoLiveDot(),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    label,
                    style: mv(13, 800, color: MovoPalette.lime),
                  ),
                ),
                Text(note, style: mv(13, 700, color: const Color(0xFFC9CBCF))),
              ],
            ),
            const SizedBox(height: 14),
            Text(
              routeTitle(order),
              style: mv(20, 800, ls: -0.02, color: MovoPalette.white),
            ),
            const SizedBox(height: 4),
            Text(
              [
                vehicleLabel(order.vehicleType),
                if (order.driverName case final name?) '$name 기사님',
              ].join(' · '),
              style: mv(13, 600, color: const Color(0xFFA5A5A0)),
            ),
            const SizedBox(height: 14),
            MovoSegments(
              total: 3,
              filled: filled,
              height: 5,
              offColor: const Color(0xFF3A3D42),
            ),
          ],
        ),
      ),
    );
  }
}

enum _TagTone { lime, danger, plain, outline }

class _PastRow extends StatelessWidget {
  const _PastRow(this.order, {required this.onTap});

  final Order order;
  final VoidCallback onTap;

  /// 금액, 줄을 그을지, 꼬리표, 꼬리표 색(라임·빨강·회색), 설명에 덧붙일 말.
  (int, bool, String, _TagTone, String?) _summary() {
    final payment = order.payment;
    final refunded = payment?.refundedAmount ?? 0;
    switch (order.status) {
      case OrderStatus.paymentFailed:
        return (order.fare, true, '결제 실패', _TagTone.danger, null);
      case OrderStatus.noShow:
        return (
          order.cancellationFee,
          false,
          '노쇼',
          _TagTone.danger,
          '요금 100% 결제',
        );
      case OrderStatus.cancelled when (payment?.paidAmount ?? 0) == 0:
        return (order.fare, true, '취소', _TagTone.outline, null);
      case OrderStatus.cancelled when order.cancellationFee == 0:
        return (
          order.fare,
          true,
          '전액 환불',
          _TagTone.lime,
          '수수료 0원 · ${won(refunded)} 환불',
        );
      case OrderStatus.cancelled:
        return (
          order.cancellationFee,
          false,
          '부분 환불',
          _TagTone.lime,
          '수수료 ${won(order.cancellationFee)} · 환불 ${won(refunded)}',
        );
      default:
        final total = payment == null || payment.paidAmount == 0
            ? order.totalFare
            : payment.finalAmount;
        return (
          total,
          false,
          refunded > 0 ? '일부 환불' : '완료',
          refunded > 0 ? _TagTone.lime : _TagTone.plain,
          order.additionalFare > 0 ? '추가 ${won(order.additionalFare)}' : null,
        );
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final (amount, struck, tag, tone, extra) = _summary();
    return Pressable(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 13),
        child: Row(
          children: [
            MovoIconTile(
              order.vehicleType == VehicleType.damas
                  ? MovoIcons.van
                  : vehicleIcon(order.vehicleType),
              size: 42,
              iconSize: 22,
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    routeTitle(order),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: mv(15, 800),
                  ),
                  const SizedBox(height: 3),
                  Text(
                    [
                      monthDay(order.requestedAt),
                      vehicleLabel(order.vehicleType),
                      ?extra,
                    ].join(' · '),
                    style: mv(12, 600, color: colors.textMuted),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 8),
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text(
                  won(amount),
                  style: mv(
                    15,
                    800,
                    tabular: true,
                    color: struck ? colors.placeholder : null,
                    decoration: struck ? TextDecoration.lineThrough : null,
                  ),
                ),
                const SizedBox(height: 4),
                MovoTag(
                  tag,
                  background: switch (tone) {
                    _TagTone.lime => MovoPalette.lime,
                    _TagTone.danger => MovoPalette.dangerSoft,
                    _TagTone.plain => colors.surfaceMuted,
                    _TagTone.outline => null,
                  },
                  foreground: switch (tone) {
                    _TagTone.lime => MovoPalette.ink,
                    _TagTone.danger => MovoPalette.danger,
                    _TagTone.plain => colors.textSecondary,
                    _TagTone.outline => colors.textMuted,
                  },
                  borderColor: tone == _TagTone.outline
                      ? colors.fieldBorder
                      : null,
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
      ),
    );
  }
}
