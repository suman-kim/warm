import 'package:flutter/material.dart';
import 'package:movo_api/movo_api.dart';
import 'package:movo_ui/movo_ui.dart';

import 'delivery_format.dart';

/// 홈에 필요한 것: 가게(이름·충전금)와 최근 배달.
typedef DeliveryHomeData = ({Store store, List<Order> orders});

/// 가게 홈. 충전금, 오늘 요청·완료·진행 중 건수, 진행 중 배달, [배달 요청] 버튼.
class DeliveryHomeScreen extends StatelessWidget {
  const DeliveryHomeScreen({
    super.key,
    required this.controller,
    required this.onRequest,
    required this.onCharge,
    required this.onOpen,
  });

  final MovoAsyncController controller;

  /// [배달 요청]을 누르면 (가게와 지금 잔액을 넘긴다).
  final void Function(Store store) onRequest;

  /// 충전금 카드를 누르면.
  final VoidCallback onCharge;

  /// 배달 하나를 누르면.
  final void Function(Order order) onOpen;

  /// 충전금이 이보다 적으면 알린다.
  static const lowBalance = 10000;

  /// 가장 싼 대행료. 이보다 적으면 배달을 요청할 수 없다.
  static const minimumFee = 3500;

  Future<DeliveryHomeData> _load(BuildContext context) async {
    final api = context.api;
    final (store, page) = await (
      api.stores.mine(),
      api.orders.list(size: 50),
    ).wait;
    return (store: store, orders: page.items);
  }

  @override
  Widget build(BuildContext context) => SafeArea(
    bottom: false,
    child: MovoAsync<DeliveryHomeData>(
      controller: controller,
      load: () => _load(context),
      // 진행 중인 배달이 있으면 상태를 따라간다.
      interval: const Duration(seconds: 10),
      keepPolling: (data) => data.orders.any((o) => isActive(o.status)),
      builder: (context, data) => _Body(
        data: data,
        onRequest: () => onRequest(data.store),
        onCharge: onCharge,
        onOpen: onOpen,
      ),
    ),
  );
}

class _Body extends StatelessWidget {
  const _Body({
    required this.data,
    required this.onRequest,
    required this.onCharge,
    required this.onOpen,
  });

  final DeliveryHomeData data;
  final VoidCallback onRequest;
  final VoidCallback onCharge;
  final void Function(Order order) onOpen;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final now = DateTime.now();
    final today = [
      for (final o in data.orders)
        if (sameDay(o.requestedAt, now)) o,
    ];
    final active = [
      for (final o in data.orders)
        if (isActive(o.status)) o,
    ];
    final done = today.where((o) => o.status == OrderStatus.delivered).length;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Expanded(
          child: ListView(
            padding: const EdgeInsets.fromLTRB(20, 12, 20, 16),
            children: [
              Row(
                children: [
                  MovoLogo(badge: MovoAppProfile.customer.logoBadge),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text(
                      data.store.name,
                      textAlign: TextAlign.right,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: mv(14, 700, color: colors.textSecondary),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 18),
              _WalletCard(balance: data.store.walletBalance, onTap: onCharge),
              const SizedBox(height: 12),
              Row(
                children: [
                  _Stat('오늘 요청', today.length),
                  const SizedBox(width: 8),
                  _Stat('완료', done),
                  const SizedBox(width: 8),
                  _Stat('진행 중', active.length),
                ],
              ),
              const SizedBox(height: 24),
              Text('진행 중 배달', style: mv(17, 800)),
              const SizedBox(height: 12),
              if (active.isEmpty)
                _Empty(todayCount: today.length)
              else
                for (final order in active) ...[
                  _ActiveCard(order, now: now, onTap: () => onOpen(order)),
                  const SizedBox(height: 10),
                ],
            ],
          ),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 4, 20, 12),
          child: MovoButton(
            '배달 요청',
            leading: const MovoIcon(MovoIcons.plus, size: 22),
            background: MovoPalette.lime,
            foreground: MovoPalette.ink,
            onPressed: onRequest,
          ),
        ),
      ],
    );
  }
}

/// 충전금 카드 (누르면 충전금 화면).
class _WalletCard extends StatelessWidget {
  const _WalletCard({required this.balance, required this.onTap});

  final int balance;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Pressable(
    onTap: onTap,
    child: Container(
      padding: const EdgeInsets.fromLTRB(20, 18, 20, 20),
      decoration: BoxDecoration(
        color: MovoPalette.ink,
        borderRadius: BorderRadius.circular(24),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  '충전금',
                  style: mv(13, 700, color: const Color(0xFFA5A5A0)),
                ),
              ),
              Container(
                height: 30,
                padding: const EdgeInsets.symmetric(horizontal: 12),
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: MovoPalette.lime,
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Text('충전하기', style: mv(13, 800, color: MovoPalette.ink)),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Text(
            won(balance),
            style: mv(
              32,
              800,
              ls: -0.03,
              tabular: true,
              color: MovoPalette.white,
            ),
          ),
          if (balance < DeliveryHomeScreen.lowBalance) ...[
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              decoration: BoxDecoration(
                color: MovoPalette.dangerNight,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Row(
                children: [
                  const MovoIcon(
                    MovoIcons.alert,
                    size: 16,
                    color: MovoPalette.dangerOnNight,
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      balance < DeliveryHomeScreen.minimumFee
                          ? '충전금이 부족해서 배달을 요청할 수 없어요'
                          : '충전금이 얼마 남지 않았어요',
                      style: mv(13, 700, color: MovoPalette.dangerOnNight),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    ),
  );
}

class _Stat extends StatelessWidget {
  const _Stat(this.label, this.count);

  final String label;
  final int count;

  @override
  Widget build(BuildContext context) => Expanded(
    child: MovoCard(
      radius: 20,
      padding: const EdgeInsets.fromLTRB(14, 14, 14, 13),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: mv(12, 700, color: context.colors.textMuted)),
          const SizedBox(height: 4),
          Text('$count건', style: mv(20, 800, tabular: true)),
        ],
      ),
    ),
  );
}

class _Empty extends StatelessWidget {
  const _Empty({required this.todayCount});

  final int todayCount;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return MovoCard(
      radius: 24,
      padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 30),
      child: Column(
        children: [
          MovoIconTile(
            MovoIcons.motorcycle,
            size: 48,
            radius: 16,
            iconSize: 24,
            background: colors.surfaceSunken,
          ),
          const SizedBox(height: 12),
          Text(
            todayCount > 0 ? '진행 중인 배달이 없어요' : '아직 요청한 배달이 없어요',
            style: mv(16, 800),
          ),
          const SizedBox(height: 4),
          Text(
            todayCount > 0 ? '오늘 $todayCount건을 요청했어요' : '아래 배달 요청 버튼으로 시작해요',
            style: mv(13, 600, color: colors.textMuted),
          ),
        ],
      ),
    );
  }
}

/// 진행 중 배달 카드.
class _ActiveCard extends StatelessWidget {
  const _ActiveCard(this.order, {required this.now, required this.onTap});

  final Order order;
  final DateTime now;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final delivery = order.storeDelivery;
    return MovoCard(
      radius: 24,
      padding: const EdgeInsets.fromLTRB(18, 16, 18, 14),
      onTap: onTap,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              StatusChip(order.status),
              const Spacer(),
              Text(
                progressNote(order, now),
                style: mv(13, 700, color: colors.textSecondary, tabular: true),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Text(
            '${customerArea(order)} · ${roadOnly(order.dropoff.address)}',
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: mv(18, 800, ls: -0.02),
          ),
          const SizedBox(height: 3),
          Text(
            order.driverName == null
                ? '주변 라이더에게 알렸어요'
                : '${order.driverName} 라이더',
            style: mv(13, 600, color: colors.textMuted),
          ),
          const SizedBox(height: 12),
          Divider(height: 1, color: colors.divider),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: Text(
                  paymentLine(delivery),
                  style: mv(13, 700, tabular: true),
                ),
              ),
              Text(
                '끝자리 ${shortCode(order)}',
                style: mv(12, 700, color: colors.textMuted, tabular: true),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
