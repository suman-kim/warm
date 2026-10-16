import 'package:flutter/material.dart';
import 'package:movo_api/movo_api.dart';
import 'package:movo_ui/movo_ui.dart';

import 'delivery_format.dart';

/// 배달 내역. 전체·완료·취소로 거르고, 날짜별로 건수와 대행료 합을 보여 준다.
class DeliveryHistoryScreen extends StatefulWidget {
  const DeliveryHistoryScreen({
    super.key,
    required this.controller,
    required this.onOpen,
  });

  final MovoAsyncController controller;

  /// 배달 하나를 누르면.
  final void Function(Order order) onOpen;

  @override
  State<DeliveryHistoryScreen> createState() => _DeliveryHistoryScreenState();
}

class _DeliveryHistoryScreenState extends State<DeliveryHistoryScreen> {
  OrderStatus? _filter;

  static const _filters = <OrderStatus?, String>{
    null: '전체',
    OrderStatus.delivered: '완료',
    OrderStatus.cancelled: '취소',
  };

  /// 그 배달로 충전금에서 나간 돈: 취소면 수수료, 아니면 대행료.
  static int _charged(Order order) => order.status == OrderStatus.cancelled
      ? order.cancellationFee
      : order.fare;

  String get _emptyTitle => switch (_filter) {
    OrderStatus.delivered => '완료한 배달이 없어요',
    OrderStatus.cancelled => '취소한 배달이 없어요',
    _ => '아직 배달 내역이 없어요',
  };

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
                Text('배달 내역', style: mv(28, 800, ls: -0.03)),
                const SizedBox(height: 18),
                Row(
                  children: [
                    for (final MapEntry(key: status, value: label)
                        in _filters.entries) ...[
                      MovoChip(
                        label,
                        selected: _filter == status,
                        height: 38,
                        radius: 19,
                        horizontalPadding: 16,
                        onTap: () {
                          setState(() => _filter = status);
                          widget.controller.reload();
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
              controller: widget.controller,
              load: () => context.api.orders.list(status: _filter, size: 50),
              builder: (context, page) {
                if (page.items.isEmpty) {
                  return MovoStateView(
                    icon: MovoIcons.list,
                    title: _emptyTitle,
                    body: '배달을 요청하면 여기에 날짜별로 쌓여요',
                    compact: true,
                  );
                }
                return ListView(
                  padding: const EdgeInsets.fromLTRB(20, 18, 20, 24),
                  children: [
                    for (final (day, orders) in groupByDay(
                      page.items,
                      (o) => o.requestedAt,
                    )) ...[
                      Padding(
                        padding: const EdgeInsets.fromLTRB(4, 0, 4, 10),
                        child: Row(
                          children: [
                            Expanded(
                              child: Text(dayLabel(day), style: mv(14, 800)),
                            ),
                            Text(
                              '${orders.length}건 · 대행료 '
                              '${won(orders.fold(0, (sum, o) => sum + _charged(o)))}',
                              style: mv(
                                12,
                                700,
                                color: colors.textMuted,
                                tabular: true,
                              ),
                            ),
                          ],
                        ),
                      ),
                      MovoRows(
                        radius: 24,
                        padding: const EdgeInsets.symmetric(
                          horizontal: 16,
                          vertical: 2,
                        ),
                        children: [
                          for (final order in orders)
                            _Row(order, onTap: () => widget.onOpen(order)),
                        ],
                      ),
                      const SizedBox(height: 18),
                    ],
                    if (page.hasMore)
                      Text(
                        '최근 50건까지 보여드려요',
                        textAlign: TextAlign.center,
                        style: mv(12, 600, color: colors.placeholder),
                      ),
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

class _Row extends StatelessWidget {
  const _Row(this.order, {required this.onTap});

  final Order order;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final cancelled = order.status == OrderStatus.cancelled;
    final delivery = order.storeDelivery;
    return Pressable(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 13),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    '${customerArea(order)} · ${roadOnly(order.dropoff.address)}',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: mv(15, 800),
                  ),
                  const SizedBox(height: 3),
                  Text(
                    [
                      ampm(order.requestedAt),
                      paymentLine(delivery),
                      if (!cancelled && order.driverName != null)
                        order.driverName!,
                    ].join(' · '),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
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
                  cancelled
                      ? (order.cancellationFee > 0
                            ? '수수료 ${won(order.cancellationFee)}'
                            : '0원')
                      : won(order.fare),
                  style: mv(
                    15,
                    800,
                    tabular: true,
                    color: cancelled ? colors.textMuted : null,
                  ),
                ),
                const SizedBox(height: 4),
                StatusChip(order.status, small: true),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
