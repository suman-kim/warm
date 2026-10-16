import 'package:flutter/material.dart';
import 'package:movo_api/movo_api.dart';
import 'package:movo_ui/movo_ui.dart';

import '../driver_scope.dart';
import '../services.dart';
import 'collect_screen.dart';
import 'finish_screens.dart';
import 'rider_board.dart';
import 'rider_format.dart';

/// 배달 진행. 배달 상태에 따라 가게로 이동 → 가게 도착(같은 가게 건을 골라 함께 픽업) →
/// 손님에게 이동을 보여 준다. 전달하면 완료 화면으로 넘어간다.
class RiderFlowScreen extends StatefulWidget {
  const RiderFlowScreen({
    super.key,
    required this.orderId,
    required this.board,
    required this.controller,
  });

  final String orderId;
  final RiderBoard board;
  final DriverController controller;

  @override
  State<RiderFlowScreen> createState() => _RiderFlowScreenState();
}

class _RiderFlowScreenState extends State<RiderFlowScreen> {
  /// 가게에서 함께 픽업하려고 고른 배달.
  Set<String>? _picks;
  bool _busy = false;

  RiderBoard get _board => widget.board;

  @override
  void initState() {
    super.initState();
    _board.addListener(_changed);
  }

  @override
  void dispose() {
    _board.removeListener(_changed);
    super.dispose();
  }

  /// 이 배달이 더는 진행 중이 아니면(가게가 취소함) 닫는다 — 취소 안내는 셸이 띄운다.
  void _changed() {
    if (!mounted) return;
    final order = _board.byId(widget.orderId);
    if (order != null && !order.isInProgress) {
      Navigator.of(context).maybePop();
      return;
    }
    setState(() {});
  }

  Future<void> _call(String number) async {
    final opened = await context.launcher.call(number);
    if (!opened && mounted) {
      showMovoToast(context, '전화를 걸 수 없어요: ${phone(number)}');
    }
  }

  Future<void> _navigate(Waypoint to, String label) async {
    final opened = await routeGuide.open(
      context,
      destination: to.coordinates,
      label: label,
      vehicleType: VehicleType.motorcycle,
    );
    if (!opened && mounted) showMovoToast(context, '길안내를 열 수 없어요');
  }

  /// 진행 단계를 넘긴다. 여러 건이면 차례로 — 하나라도 실패하면 거기서 멈추고 알린다.
  Future<bool> _run(List<Future<Order> Function()> steps) async {
    setState(() => _busy = true);
    var ok = true;
    for (final step in steps) {
      final order = await runAction(context, step);
      if (!mounted) return false;
      if (order == null) {
        ok = false;
        break;
      }
      _board.put(order);
    }
    if (mounted) setState(() => _busy = false);
    await _board.refresh();
    return ok;
  }

  /// 가게 도착: 같은 가게로 가는 중인 배달을 모두 도착으로 바꾼다.
  Future<void> _arrive(Order order) async {
    final api = context.api;
    final group = [
      order,
      for (final other in _board.sameStore(order))
        if (other.status == OrderStatus.assigned ||
            other.status == OrderStatus.departed)
          other,
    ];
    final ok = await _run([
      for (final o in group) () => api.dispatch.arrive(o.id),
    ]);
    if (ok && mounted) {
      // 도착한 같은 가게 건은 처음에 모두 골라 둔다.
      setState(() => _picks = {for (final o in group) o.id});
    }
  }

  Future<void> _pickUp(List<Order> picked) async {
    if (picked.isEmpty) {
      showMovoToast(context, '픽업할 배달을 골라 주세요');
      return;
    }
    final api = context.api;
    await _run([for (final o in picked) () => api.dispatch.pickUp(o.id)]);
  }

  Future<void> _deliver(Order order) async {
    final delivery = order.storeDelivery;
    final navigator = Navigator.of(context);
    Order? done;
    if (delivery.doorPayment.collectsAtDoor) {
      done = await navigator.push<Order>(
        MaterialPageRoute(builder: (_) => CollectScreen(order: order)),
      );
    } else {
      final api = context.api;
      setState(() => _busy = true);
      done = await runAction(context, () => api.dispatch.complete(order.id));
      if (mounted) setState(() => _busy = false);
    }
    if (done == null || !mounted) return;
    _board.put(done);
    await _board.refresh();
    if (!mounted) return;
    final finished = done;
    await navigator.pushReplacement<void, void>(
      MaterialPageRoute(
        builder: (_) => DeliveredScreen(
          order: finished,
          board: _board,
          controller: widget.controller,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final order = _board.byId(widget.orderId);
    if (order == null) {
      return const Scaffold(body: MovoLoading());
    }
    final stage = switch (order.status) {
      OrderStatus.arrived => _Stage.atStore,
      OrderStatus.pickedUp => _Stage.toCustomer,
      _ => _Stage.toStore,
    };
    final atStore = [
      order,
      for (final other in _board.sameStore(order))
        if (other.status == OrderStatus.arrived) other,
    ];
    final picks = _picks ?? {for (final o in atStore) o.id};
    final picked = [
      for (final o in atStore)
        if (picks.contains(o.id)) o,
    ];
    return MovoPage(
      title: stage.title,
      bottom: switch (stage) {
        _Stage.toStore => MovoButton(
          '가게 도착',
          loading: _busy,
          onPressed: () => _arrive(order),
        ),
        _Stage.atStore => MovoButton(
          '픽업 완료 · ${picked.length}건',
          loading: _busy,
          onPressed: () => _pickUp(picked),
        ),
        _Stage.toCustomer => MovoButton(
          '전달 완료',
          loading: _busy,
          onPressed: () => _deliver(order),
        ),
      },
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _Progress(stage),
          const SizedBox(height: 18),
          if (stage == _Stage.atStore)
            ..._atStore(order, atStore, picks)
          else ...[
            _MapCard(order: order, rider: widget.controller.lastLocation),
            const SizedBox(height: 12),
            if (stage == _Stage.toStore)
              _toStore(order)
            else
              _toCustomer(order),
          ],
        ],
      ),
    );
  }

  Widget _toStore(Order order) {
    final colors = context.colors;
    final delivery = order.storeDelivery;
    final others = _board.sameStore(order).length;
    final ready = readyText(delivery.readyAt);
    return MovoCard(
      radius: 24,
      padding: const EdgeInsets.all(18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('픽업할 가게', style: mv(12, 700, color: colors.textMuted)),
          const SizedBox(height: 6),
          Text(storeNameOf(order), style: mv(24, 800, ls: -0.02)),
          const SizedBox(height: 4),
          Text(
            [
              order.pickup.address,
              if (order.pickup.detailAddress?.isNotEmpty ?? false)
                order.pickup.detailAddress!,
            ].join(' '),
            style: mv(14, 600, color: colors.textSecondary),
          ),
          const SizedBox(height: 14),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            decoration: BoxDecoration(
              color: colors.surfaceMuted,
              borderRadius: BorderRadius.circular(10),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                MovoIcon(MovoIcons.clock, size: 15, color: colors.text),
                const SizedBox(width: 6),
                Text(
                  ready == '바로 픽업' || delivery.readyAt == null
                      ? '조리 끝 · 바로 픽업'
                      : '$ready · ${ampm(delivery.readyAt!)} 조리 완료',
                  style: mv(13, 800, tabular: true),
                ),
              ],
            ),
          ),
          if (others > 0) ...[
            const SizedBox(height: 12),
            Text(
              '같은 가게 배달 $others건이 더 있어요 · 한 번에 픽업하세요',
              style: mv(13, 700, color: MovoPalette.lime),
            ),
          ],
          const SizedBox(height: 14),
          Row(
            children: [
              _ActionButton(
                MovoIcons.navigation,
                '카카오내비',
                onTap: () => _navigate(order.pickup, storeNameOf(order)),
              ),
              const SizedBox(width: 8),
              _ActionButton(
                MovoIcons.phone,
                '가게 전화',
                onTap: () => _call(order.pickup.contactPhone),
              ),
            ],
          ),
        ],
      ),
    );
  }

  List<Widget> _atStore(Order order, List<Order> atStore, Set<String> picks) {
    final colors = context.colors;
    return [
      Container(
        padding: const EdgeInsets.fromLTRB(20, 18, 20, 20),
        decoration: BoxDecoration(
          color: MovoPalette.lime,
          borderRadius: BorderRadius.circular(24),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              '가게에 주문번호 끝자리를 말해 주세요',
              style: mv(13, 800, color: MovoPalette.ink),
            ),
            const SizedBox(height: 4),
            Text(
              shortCode(order),
              style: mv(52, 800, ls: 0.02, color: MovoPalette.ink),
            ),
            const SizedBox(height: 2),
            Text(
              storeNameOf(order),
              style: mv(14, 700, color: MovoPalette.ink),
            ),
          ],
        ),
      ),
      const SizedBox(height: 12),
      MovoCard(
        radius: 24,
        padding: const EdgeInsets.fromLTRB(18, 18, 18, 6),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                Expanded(child: Text('함께 픽업할 배달', style: mv(16, 800))),
                Text(
                  '같은 가게 건을 골라요',
                  style: mv(12, 600, color: colors.textMuted),
                ),
              ],
            ),
            const SizedBox(height: 6),
            for (final (index, o) in atStore.indexed) ...[
              if (index > 0) Divider(height: 1, color: colors.divider),
              _PickRow(
                order: o,
                picked: picks.contains(o.id),
                onTap: () => setState(() {
                  final next = {...picks};
                  if (!next.remove(o.id)) next.add(o.id);
                  _picks = next;
                }),
              ),
            ],
          ],
        ),
      ),
    ];
  }

  Widget _toCustomer(Order order) {
    final colors = context.colors;
    final delivery = order.storeDelivery;
    return MovoCard(
      radius: 24,
      padding: const EdgeInsets.all(18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            '${roadOnly(order.dropoff.address)} · ${dongOf(order.dropoff)}',
            style: mv(13, 700, color: colors.textMuted),
          ),
          const SizedBox(height: 4),
          Text(
            order.dropoff.detailAddress?.isNotEmpty ?? false
                ? order.dropoff.detailAddress!
                : '상세주소 없음',
            style: mv(26, 800, ls: -0.02),
          ),
          const SizedBox(height: 14),
          Container(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 14),
            decoration: BoxDecoration(
              color: colors.surfaceMuted,
              borderRadius: BorderRadius.circular(16),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('요청사항', style: mv(12, 700, color: colors.textMuted)),
                const SizedBox(height: 4),
                Text(
                  order.memo?.isNotEmpty ?? false ? order.memo! : '요청사항이 없어요',
                  style: mv(16, 800, height: 1.45),
                ),
              ],
            ),
          ),
          const SizedBox(height: 10),
          PayBadge(
            payment: delivery.doorPayment,
            foodAmount: delivery.foodAmount,
            long: true,
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              _ActionButton(
                MovoIcons.navigation,
                '카카오내비',
                onTap: () => _navigate(order.dropoff, dongOf(order.dropoff)),
              ),
              const SizedBox(width: 8),
              _ActionButton(
                MovoIcons.phone,
                '손님 전화',
                onTap: () => _call(order.dropoff.contactPhone),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

enum _Stage {
  toStore('가게로 이동', 1),
  atStore('가게 도착', 2),
  toCustomer('손님에게 이동', 3);

  const _Stage(this.title, this.step);

  final String title;

  /// 수락 0 · 가게 도착 1 · 픽업 2 · 전달 3 중 지금 할 차례
  final int step;
}

/// 수락 · 가게 도착 · 픽업 · 전달 — 지난 단계는 라임, 지금 할 단계는 흰색.
class _Progress extends StatelessWidget {
  const _Progress(this.stage);

  final _Stage stage;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    const labels = ['수락', '가게 도착', '픽업', '전달'];
    return Row(
      children: [
        for (final (i, label) in labels.indexed) ...[
          if (i > 0) const SizedBox(width: 4),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  height: 4,
                  decoration: BoxDecoration(
                    color: i < stage.step
                        ? MovoPalette.lime
                        : i == stage.step
                        ? colors.text
                        : colors.surfaceMuted,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  label,
                  style: mv(
                    12,
                    800,
                    color: i <= stage.step ? colors.text : colors.placeholder,
                  ),
                ),
              ],
            ),
          ),
        ],
      ],
    );
  }
}

/// 가게 · 손님 · 내 위치 지도.
class _MapCard extends StatelessWidget {
  const _MapCard({required this.order, required this.rider});

  final Order order;
  final Coordinates? rider;

  @override
  Widget build(BuildContext context) => ClipRRect(
    borderRadius: BorderRadius.circular(24),
    child: SizedBox(
      height: 190,
      child: MovoMap(
        padding: const EdgeInsets.fromLTRB(60, 50, 60, 30),
        markers: [
          MovoMapMarker(
            order.pickup.coordinates,
            const MapPin(label: '가게', icon: MovoIcons.store),
            offset: const Offset(0, -18),
          ),
          MovoMapMarker(
            order.dropoff.coordinates,
            const MapPin(label: '손님', lime: true),
            offset: const Offset(0, -18),
          ),
          if (rider case final at?) ...[
            MovoMapMarker(at, const MovoPulse.ping()),
            MovoMapMarker(at, const RiderDot()),
          ],
        ],
      ),
    ),
  );
}

/// 지도 위 꼬리 달린 이름표 (가게: 흰색, 손님: 라임).
class MapPin extends StatelessWidget {
  const MapPin({super.key, required this.label, this.icon, this.lime = false});

  final String label;
  final MovoIcons? icon;
  final bool lime;

  @override
  Widget build(BuildContext context) => Column(
    mainAxisSize: MainAxisSize.min,
    children: [
      Container(
        height: 28,
        padding: const EdgeInsets.symmetric(horizontal: 10),
        decoration: BoxDecoration(
          color: lime ? MovoPalette.lime : MovoPalette.white,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: MovoPalette.ink, width: 1.5),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (icon != null) ...[
              MovoIcon(icon!, size: 14, color: MovoPalette.ink),
              const SizedBox(width: 5),
            ],
            Text(label, style: mv(12, 800, color: MovoPalette.ink)),
          ],
        ),
      ),
      Container(width: 2, height: 8, color: MovoPalette.white),
    ],
  );
}

/// 지도 위 내 위치 (라임 원에 오토바이).
class RiderDot extends StatelessWidget {
  const RiderDot({super.key});

  @override
  Widget build(BuildContext context) => Container(
    width: 40,
    height: 40,
    alignment: Alignment.center,
    decoration: BoxDecoration(
      color: MovoPalette.lime,
      shape: BoxShape.circle,
      border: Border.all(color: MovoPalette.ink, width: 2),
    ),
    child: const MovoIcon(
      MovoIcons.motorcycle,
      size: 18,
      color: MovoPalette.ink,
    ),
  );
}

class _ActionButton extends StatelessWidget {
  const _ActionButton(this.icon, this.label, {required this.onTap});

  final MovoIcons icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Expanded(
    child: Pressable(
      onTap: onTap,
      child: Container(
        height: 50,
        decoration: BoxDecoration(
          color: context.colors.surfaceMuted,
          borderRadius: BorderRadius.circular(14),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            MovoIcon(icon, size: 18, color: context.colors.text),
            const SizedBox(width: 8),
            Text(label, style: mv(14, 800)),
          ],
        ),
      ),
    ),
  );
}

/// 함께 픽업할 배달 한 줄 (고르는 칸).
class _PickRow extends StatelessWidget {
  const _PickRow({
    required this.order,
    required this.picked,
    required this.onTap,
  });

  final Order order;
  final bool picked;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final delivery = order.storeDelivery;
    final collects = delivery.doorPayment.collectsAtDoor;
    return Semantics(
      checked: picked,
      button: true,
      label: destinationLine(order),
      child: Pressable(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 13),
          child: Row(
            children: [
              Container(
                width: 24,
                height: 24,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: picked ? MovoPalette.lime : null,
                  borderRadius: BorderRadius.circular(7),
                  border: picked
                      ? null
                      : Border.all(color: colors.placeholder, width: 2),
                ),
                child: picked
                    ? const MovoIcon(
                        MovoIcons.check,
                        size: 12,
                        color: MovoPalette.ink,
                      )
                    : null,
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(destinationLine(order), style: mv(15, 800)),
                    const SizedBox(height: 2),
                    Text(
                      collects
                          ? '${payLabel(delivery.doorPayment)} ${won(delivery.foodAmount)}'
                          : '선결제',
                      style: mv(
                        12,
                        700,
                        color: collects ? MovoPalette.lime : colors.textMuted,
                        tabular: true,
                      ),
                    ),
                  ],
                ),
              ),
              Text(
                shortCode(order),
                style: mv(13, 800, color: colors.textMuted, tabular: true),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
