import 'package:flutter/material.dart';
import 'package:movo_api/movo_api.dart';
import 'package:movo_ui/movo_ui.dart';

import 'rider_board.dart';
import 'rider_format.dart';

/// 진행 중 배달. 같은 가게 배달은 묶어서 보여 준다 — 한 번 들러서 함께 픽업한다.
class ActiveDeliveriesScreen extends StatelessWidget {
  const ActiveDeliveriesScreen({
    super.key,
    required this.board,
    required this.onOpen,
  });

  final RiderBoard board;
  final void Function(Order order) onOpen;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return SafeArea(
      bottom: false,
      child: ListenableBuilder(
        listenable: board,
        builder: (context, _) {
          final active = board.active;
          final groups = <String, List<Order>>{};
          for (final order in active) {
            groups
                .putIfAbsent(order.storeDelivery.storeId, () => [])
                .add(order);
          }
          return ListView(
            padding: const EdgeInsets.fromLTRB(20, 12, 20, 24),
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text('진행 중 배달', style: mv(28, 800, ls: -0.03)),
                  ),
                  Text(
                    '${active.length}/$maxActiveDeliveries',
                    style: mv(17, 800, color: MovoPalette.lime, tabular: true),
                  ),
                ],
              ),
              const SizedBox(height: 18),
              if (active.isEmpty)
                MovoStateView(
                  icon: MovoIcons.motorcycle,
                  title: '진행 중인 배달이 없어요',
                  body: '콜을 수락하면 여기에 모여요. 동시에 3건까지 맡을 수 있어요',
                  compact: true,
                )
              else ...[
                for (final items in groups.values) ...[
                  _StoreHeader(items),
                  const SizedBox(height: 10),
                  MovoRows(
                    radius: 22,
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    children: [
                      for (final order in items)
                        _Row(order, onTap: () => onOpen(order)),
                    ],
                  ),
                  const SizedBox(height: 18),
                ],
                Text(
                  '같은 가게 배달은 묶어서 보여 드려요. 한 번 들러서 함께 픽업하세요.',
                  style: mv(12, 600, color: colors.textMuted, height: 1.5),
                ),
              ],
            ],
          );
        },
      ),
    );
  }
}

class _StoreHeader extends StatelessWidget {
  const _StoreHeader(this.items);

  final List<Order> items;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final first = items.first;
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 4),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              MovoIcon(MovoIcons.store, size: 16, color: colors.text),
              const SizedBox(width: 6),
              Text(storeNameOf(first), style: mv(16, 800)),
            ],
          ),
          const SizedBox(height: 3),
          Text(
            items.length > 1
                ? '같은 가게 ${items.length}건 · 한 번에 픽업해요'
                : first.pickup.address,
            style: mv(
              12,
              700,
              color: items.length > 1 ? MovoPalette.lime : colors.textMuted,
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
    final (stage, next) = stageOf(order.status);
    final onTheWay = order.status == OrderStatus.pickedUp;
    return Pressable(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 14),
        child: Row(
          children: [
            MovoIconTile(
              onTheWay ? MovoIcons.motorcycle : MovoIcons.store,
              size: 44,
              radius: 14,
              iconSize: 20,
              background: onTheWay ? MovoPalette.lime : colors.surfaceMuted,
              foreground: onTheWay ? MovoPalette.ink : colors.text,
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(stage, style: mv(12, 800, color: MovoPalette.lime)),
                  const SizedBox(height: 2),
                  Text(destinationLine(order), style: mv(16, 800)),
                  const SizedBox(height: 2),
                  Text(next, style: mv(12, 600, color: colors.textMuted)),
                ],
              ),
            ),
            MovoIcon(
              MovoIcons.chevronRight,
              size: 18,
              color: colors.placeholder,
            ),
          ],
        ),
      ),
    );
  }
}
