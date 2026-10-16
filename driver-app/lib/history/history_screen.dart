import 'package:flutter/material.dart';
import 'package:movo_api/movo_api.dart';
import 'package:movo_ui/movo_ui.dart';

import '../delivery/rider_format.dart';
import 'trip_detail_screen.dart';

/// 배달 내역. 마친 배달과 취소된 배달을 날짜별로 보여 준다.
class DeliveryHistoryScreen extends StatelessWidget {
  const DeliveryHistoryScreen({super.key, required this.reload});

  final MovoAsyncController reload;

  /// 이 배달로 받는 금액 (취소면 취소 보상).
  static int amountOf(Order order) => order.earning ?? 0;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return SafeArea(
      bottom: false,
      child: MovoAsync<List<Order>>(
        controller: reload,
        load: () async {
          final page = await context.api.dispatch.myOrders(size: 50);
          return [
            for (final order in page.items)
              if (order.status == OrderStatus.delivered ||
                  order.status == OrderStatus.cancelled)
                order,
          ];
        },
        builder: (context, orders) {
          final now = DateTime.now();
          final today = [
            for (final o in orders)
              if (o.status == OrderStatus.delivered &&
                  sameDay(_finishedAt(o), now))
                o,
          ];
          final groups = <(DateTime, List<Order>)>[];
          for (final order in orders) {
            final at = _finishedAt(order);
            if (groups.isNotEmpty && sameDay(groups.last.$1, at)) {
              groups.last.$2.add(order);
            } else {
              groups.add((at, [order]));
            }
          }
          return ListView(
            padding: const EdgeInsets.fromLTRB(20, 12, 20, 24),
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Expanded(child: Text('배달 내역', style: mv(28, 800, ls: -0.03))),
                  Padding(
                    padding: const EdgeInsets.only(bottom: 6),
                    child: Text(
                      '오늘 ${today.length}건 · '
                      '${won(today.fold(0, (sum, o) => sum + amountOf(o)))}',
                      style: mv(
                        13,
                        700,
                        color: colors.textMuted,
                        tabular: true,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 18),
              if (orders.isEmpty) ...[
                Padding(
                  padding: const EdgeInsets.fromLTRB(4, 0, 4, 10),
                  child: Text(
                    '${dayHeading(now)} (${weekday(now)})',
                    style: mv(14, 800),
                  ),
                ),
                const MovoStateView(
                  icon: MovoIcons.list,
                  title: '오늘 배달한 내역이 없어요',
                  body: '배달을 마치면 여기에 쌓여요',
                  compact: true,
                ),
              ] else
                for (final (day, items) in groups) ...[
                  Padding(
                    padding: const EdgeInsets.fromLTRB(4, 0, 4, 10),
                    child: Text(
                      '${dayHeading(day)} (${weekday(day)})',
                      style: mv(14, 800),
                    ),
                  ),
                  MovoRows(
                    radius: 22,
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    children: [
                      for (final order in items)
                        _Row(
                          order,
                          onTap: () => Navigator.of(context).push(
                            MaterialPageRoute<void>(
                              builder: (_) => TripDetailScreen(order: order),
                            ),
                          ),
                        ),
                    ],
                  ),
                  const SizedBox(height: 18),
                ],
            ],
          );
        },
      ),
    );
  }
}

DateTime _finishedAt(Order order) =>
    order.deliveredAt ?? order.cancelledAt ?? order.requestedAt;

class _Row extends StatelessWidget {
  const _Row(this.order, {required this.onTap});

  final Order order;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final cancelled = order.status == OrderStatus.cancelled;
    final amount = DeliveryHistoryScreen.amountOf(order);
    return Pressable(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 14),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Flexible(
                        child: Text(
                          storeNameOf(order),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: mv(15, 800),
                        ),
                      ),
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 4),
                        child: MovoIcon(
                          MovoIcons.chevronRight,
                          size: 14,
                          color: colors.text,
                        ),
                      ),
                      Text(dongOf(order.dropoff), style: mv(15, 800)),
                    ],
                  ),
                  const SizedBox(height: 5),
                  Row(
                    children: [
                      Text(
                        ampm(_finishedAt(order)),
                        style: mv(12, 600, color: colors.textMuted),
                      ),
                      const SizedBox(width: 8),
                      _Chip(order),
                    ],
                  ),
                ],
              ),
            ),
            Text(
              cancelled && amount == 0 ? '0원' : '+${won(amount)}',
              style: mv(
                16,
                800,
                tabular: true,
                color: cancelled ? colors.textMuted : null,
              ),
            ),
            const SizedBox(width: 6),
            MovoIcon(
              MovoIcons.chevronRight,
              size: 16,
              color: colors.placeholder,
            ),
          ],
        ),
      ),
    );
  }
}

/// 받은 돈 꼬리표: 현금 27,000원 / 카드 18,500원 / 선결제 / 취소됨
class _Chip extends StatelessWidget {
  const _Chip(this.order);

  final Order order;

  @override
  Widget build(BuildContext context) {
    final delivery = order.storeDelivery;
    final (label, background, foreground) = switch (order.status) {
      OrderStatus.cancelled => (
        '취소됨',
        MovoPalette.dangerNight,
        MovoPalette.dangerOnNight,
      ),
      _ when delivery.collectedMethod == DoorPayment.cash => (
        collectedText(delivery),
        MovoPalette.lime,
        MovoPalette.ink,
      ),
      _ when delivery.collectedMethod == DoorPayment.card => (
        collectedText(delivery),
        const Color(0xFFF2F2EE),
        MovoPalette.ink,
      ),
      _ => ('선결제', context.colors.surfaceMuted, const Color(0xFFC9CBCF)),
    };
    return MovoTag(
      label,
      background: background,
      foreground: foreground,
      fontSize: 11,
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
      radius: 7,
    );
  }
}
