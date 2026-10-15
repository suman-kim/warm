import 'package:flutter/material.dart';
import 'package:movo_api/movo_api.dart';
import 'package:movo_ui/movo_ui.dart';

import '../delivery/accept_screens.dart';
import '../delivery/delivery_screen.dart';
import '../driver_scope.dart';
import 'new_call_screen.dart';

/// 홈. 운행을 켜고 끄고, 대기 중인 콜을 보고 수락한다.
class DriverHomeScreen extends StatefulWidget {
  const DriverHomeScreen({
    super.key,
    required this.controller,
    required this.reload,
  });

  final DriverController controller;
  final MovoAsyncController reload;

  @override
  State<DriverHomeScreen> createState() => _DriverHomeScreenState();
}

class _Summary {
  const _Summary({
    required this.earnings,
    required this.count,
    required this.deliveries,
    required this.active,
  });

  /// 오늘 수입(원)
  final int earnings;

  /// 오늘 완료한 배송 수
  final int count;

  /// 오늘 완료한 배송 (최근 것부터)
  final List<Order> deliveries;

  /// 진행 중인 배송. 없으면 null.
  final Order? active;
}

class _DriverHomeScreenState extends State<DriverHomeScreen> {
  final _calls = MovoAsyncController();

  /// 이미 본 콜. 새로 들어온 콜만 크게 띄운다.
  Set<String>? _seen;
  bool _resumed = false;
  bool _toggling = false;
  String? _accepting;

  Driver get _driver => widget.controller.driver!;

  @override
  void dispose() {
    _calls.dispose();
    super.dispose();
  }

  Future<_Summary> _load() async {
    final api = context.api;
    final now = DateTime.now();
    final (earnings, today, recent) = await (
      api.dispatch.earnings(from: now, to: now),
      api.dispatch.myOrders(
        from: now,
        to: now,
        status: OrderStatus.delivered,
        size: 30,
      ),
      api.dispatch.myOrders(size: 10),
    ).wait;
    // 진행 중인 배송(배차 완료·출발·도착·배송 중)은 한 건뿐이다.
    final active = recent.items
        .where((order) => order.isInProgress)
        .firstOrNull;
    // 앱을 켰는데 진행 중인 배송이 있으면 그 화면으로 바로 이어 준다.
    if (active != null && !_resumed) {
      _resumed = true;
      WidgetsBinding.instance.addPostFrameCallback(
        (_) => _openDelivery(active),
      );
    }
    _resumed = true;
    return _Summary(
      earnings: earnings.daily.lastOrNull?.sales ?? 0,
      count: earnings.daily.lastOrNull?.completedCount ?? 0,
      deliveries: today.items,
      active: active,
    );
  }

  Future<void> _toggle(bool available) async {
    if (_toggling) return;
    setState(() => _toggling = true);
    await runAction(
      context,
      () => widget.controller.setAvailability(available),
    );
    if (!mounted) return;
    setState(() {
      _toggling = false;
      _seen = null;
    });
  }

  Future<void> _openDelivery(Order order) async {
    if (!mounted) return;
    await Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) =>
            DeliveryScreen(order: order, controller: widget.controller),
      ),
    );
    await widget.controller.refresh();
    widget.reload.reload();
    _calls.reload();
  }

  /// 수락한다. 고객 카드 결제가 끝날 때까지 '결제 확인 중'을 보여 주고,
  /// 결제되면 배송 화면으로, 안 되면 '배차 안 됨'으로 간다.
  Future<void> _accept(OpenOrder call) async {
    if (_accepting != null) return;
    setState(() => _accepting = call.id);
    final api = context.api;
    final navigator = Navigator.of(context);
    final result = await navigator.push<Object>(
      MaterialPageRoute(
        builder: (_) => PayingScreen(
          call: call,
          accept: () => api.dispatch.accept(call.id),
        ),
      ),
    );
    if (!mounted) return;
    setState(() => _accepting = null);
    switch (result) {
      case Order order:
        await _openDelivery(order);
      case ApiException(code: ApiErrorCode.paymentDeclined):
        await navigator.push<void>(
          MaterialPageRoute(builder: (_) => PaymentDeclinedScreen(call: call)),
        );
        _calls.reload();
      case ApiException(code: ApiErrorCode.orderNotOpen) ||
          ApiException(code: ApiErrorCode.staleAggregate):
        showMovoToast(context, '다른 기사님이 먼저 수락했어요.');
        _calls.reload();
      case final Object error:
        showMovoToast(context, errorMessage(error));
        _calls.reload();
      case null:
        break;
    }
  }

  /// 콜을 크게 띄운다. 수락하면 배송 화면으로 넘어간다.
  Future<void> _showCall(OpenOrder call, {bool countdown = false}) async {
    final accepted = await Navigator.of(context).push(
      MaterialPageRoute<bool>(
        fullscreenDialog: true,
        builder: (_) => NewCallScreen(call: call, countdown: countdown),
      ),
    );
    if (accepted == true && mounted) await _accept(call);
  }

  Future<Paged<OpenOrder>> _loadCalls() async {
    final page = await context.api.dispatch.openOrders(size: 30);
    final ids = {for (final call in page.items) call.id};
    final seen = _seen;
    if (seen != null && mounted && ModalRoute.of(context)!.isCurrent) {
      final fresh = page.items.where((call) => !seen.contains(call.id));
      if (fresh.isNotEmpty) {
        final call = fresh.first;
        WidgetsBinding.instance.addPostFrameCallback(
          (_) => _showCall(call, countdown: true),
        );
      }
    }
    _seen = ids;
    return page;
  }

  @override
  Widget build(BuildContext context) {
    final driver = _driver;
    return SafeArea(
      bottom: false,
      child: MovoAsync<_Summary>(
        controller: widget.reload,
        load: _load,
        builder: (context, summary) => !driver.available
            ? _list([
                _header(driver),
                const SizedBox(height: 16),
                if (summary.active case final active?) ...[
                  _ActiveCard(active, onTap: () => _openDelivery(active)),
                  const SizedBox(height: 16),
                ],
                _OfflinePanel(
                  vehicle: vehicleLabel(driver.vehicleType),
                  busy: _toggling,
                  onStart: () => _toggle(true),
                ),
                const SizedBox(height: 16),
                _Stats(summary),
                const SizedBox(height: 16),
                MovoCard(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 16,
                    vertical: 14,
                  ),
                  child: Row(
                    children: [
                      const MovoIconTile(
                        MovoIcons.clock,
                        size: 40,
                        radius: 12,
                        iconSize: 20,
                      ),
                      const SizedBox(width: 12),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            '오늘 운행 시간',
                            style: mv(13, 700, color: context.colors.textMuted),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            duration(driver.todayOnline),
                            style: mv(16, 800),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ])
            : MovoAsync<Paged<OpenOrder>>(
                controller: _calls,
                load: _loadCalls,
                interval: const Duration(seconds: 5),
                builder: (context, calls) => calls.items.isEmpty
                    ? _list([
                        _header(driver),
                        const SizedBox(height: 16),
                        if (summary.active case final active?) ...[
                          _ActiveCard(
                            active,
                            onTap: () => _openDelivery(active),
                          ),
                          const SizedBox(height: 16),
                        ],
                        _RadarPanel(driver),
                        const SizedBox(height: 16),
                        _Stats(summary),
                        if (summary.deliveries.isNotEmpty) ...[
                          const SizedBox(height: 16),
                          Text('오늘 운행', style: mv(15, 800)),
                          const SizedBox(height: 10),
                          MovoRows(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 16,
                              vertical: 2,
                            ),
                            children: [
                              for (final order in summary.deliveries)
                                _TodayRow(order),
                            ],
                          ),
                        ],
                      ])
                    : _list([
                        _header(driver),
                        const SizedBox(height: 16),
                        if (summary.active case final active?) ...[
                          _ActiveCard(
                            active,
                            onTap: () => _openDelivery(active),
                          ),
                          const SizedBox(height: 14),
                        ],
                        Row(
                          children: [
                            Text('대기 중인 콜', style: mv(20, 800, ls: -0.02)),
                            const SizedBox(width: 8),
                            Container(
                              constraints: const BoxConstraints(minWidth: 24),
                              height: 24,
                              padding: const EdgeInsets.symmetric(
                                horizontal: 7,
                              ),
                              alignment: Alignment.center,
                              decoration: BoxDecoration(
                                color: MovoPalette.lime,
                                borderRadius: BorderRadius.circular(12),
                              ),
                              child: Text(
                                '${calls.total}',
                                style: mv(13, 900, color: MovoPalette.ink),
                              ),
                            ),
                            const Spacer(),
                            Text(
                              '${vehicleLabel(driver.vehicleType)} 콜만 보여요',
                              style: mv(
                                13,
                                700,
                                color: context.colors.textMuted,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 14),
                        for (final (index, call) in calls.items.indexed) ...[
                          CallCard(
                            call,
                            highlighted: index == 0,
                            accepting: _accepting == call.id,
                            onTap: () => _showCall(call),
                            onAccept: () => _accept(call),
                          ),
                          const SizedBox(height: 14),
                        ],
                      ]),
              ),
      ),
    );
  }

  Widget _list(List<Widget> children) => ListView(
    padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
    children: children,
  );

  Widget _header(Driver driver) {
    final colors = context.colors;
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        const MovoLogo(size: 24, badge: '기사'),
        Container(
          padding: const EdgeInsets.fromLTRB(14, 6, 6, 6),
          decoration: BoxDecoration(
            color: colors.surface,
            borderRadius: BorderRadius.circular(24),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                driver.available ? '운행 중' : '운행 종료',
                style: mv(
                  13,
                  800,
                  color: driver.available ? colors.text : colors.textFaint,
                ),
              ),
              const SizedBox(width: 10),
              MovoToggle(
                value: driver.available,
                onChanged: _toggling ? null : _toggle,
              ),
            ],
          ),
        ),
      ],
    );
  }
}

/// 운행이 꺼져 있을 때의 큰 패널.
class _OfflinePanel extends StatelessWidget {
  const _OfflinePanel({
    required this.vehicle,
    required this.busy,
    required this.onStart,
  });

  final String vehicle;
  final bool busy;
  final VoidCallback onStart;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Container(
      height: 300,
      padding: const EdgeInsets.symmetric(horizontal: 28),
      decoration: BoxDecoration(
        color: colors.surfaceDeep,
        borderRadius: BorderRadius.circular(30),
      ),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          MovoIconTile(
            MovoIcons.power,
            size: 64,
            iconSize: 28,
            circle: true,
            background: colors.surfaceMuted,
            foreground: colors.textFaint,
          ),
          const SizedBox(height: 16),
          Text('운행이 꺼져 있어요', style: mv(22, 800, ls: -0.02)),
          const SizedBox(height: 12),
          Text(
            '운행을 켜야 $vehicle 콜을 받을 수 있어요. 꺼져 있는 동안에는 콜 푸시가 오지 않아요.',
            textAlign: TextAlign.center,
            style: mv(14, 600, color: colors.textMuted, height: 1.55),
          ),
          const SizedBox(height: 20),
          MovoButton(
            '운행 시작',
            onPressed: onStart,
            loading: busy,
            expand: false,
            height: 52,
            radius: 16,
            fontSize: 16,
            horizontalPadding: 26,
            leading: const MovoIcon(
              MovoIcons.power,
              size: 18,
              color: MovoPalette.ink,
            ),
          ),
        ],
      ),
    );
  }
}

/// 운행 중이고 대기 콜이 없을 때의 레이더.
class _RadarPanel extends StatelessWidget {
  const _RadarPanel(this.driver);

  final Driver driver;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final since = driver.onlineSince;
    Widget ring(double size, Color color) => Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        border: Border.all(color: color),
      ),
    );
    return Container(
      height: 300,
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        color: colors.surfaceDeep,
        borderRadius: BorderRadius.circular(30),
      ),
      child: Stack(
        children: [
          Positioned(
            left: 0,
            right: 0,
            top: 124,
            child: SizedBox(
              height: 0,
              child: OverflowBox(
                // 패널이 고리보다 넓은 기기에서도 고리는 제 크기로 그린다.
                minWidth: 0,
                minHeight: 0,
                maxWidth: 340,
                maxHeight: 340,
                child: Stack(
                  alignment: Alignment.center,
                  children: [
                    ring(340, const Color(0xFF1D2023)),
                    ring(220, const Color(0xFF212428)),
                    ring(120, const Color(0xFF26292D)),
                    const MovoPulse.radar(),
                    Container(
                      width: 54,
                      height: 54,
                      alignment: Alignment.center,
                      decoration: const BoxDecoration(
                        color: MovoPalette.lime,
                        shape: BoxShape.circle,
                      ),
                      child: MovoIcon(
                        vehicleIcon(driver.vehicleType),
                        size: 26,
                        color: MovoPalette.ink,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
          if (since != null)
            Positioned(
              top: 18,
              left: 20,
              child: Row(
                children: [
                  const MovoLiveDot(ring: false),
                  const SizedBox(width: 8),
                  Text(
                    '운행 ${duration(DateTime.now().difference(since))}째',
                    style: mv(12, 700, color: colors.textSecondary),
                  ),
                ],
              ),
            ),
          Positioned(
            left: 24,
            right: 24,
            bottom: 26,
            child: Column(
              children: [
                Text('콜을 기다리고 있어요', style: mv(22, 800, ls: -0.02)),
                const SizedBox(height: 6),
                Text(
                  '${vehicleLabel(driver.vehicleType)} 요청이 들어오면 바로 알려드려요',
                  style: mv(14, 600, color: colors.textMuted),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// 오늘 수입과 완료 건수.
class _Stats extends StatelessWidget {
  const _Stats(this.summary);

  final _Summary summary;

  @override
  Widget build(BuildContext context) =>
      TodayStats(earnings: summary.earnings, count: summary.count);
}

class TodayStats extends StatelessWidget {
  const TodayStats({super.key, required this.earnings, required this.count});

  final int earnings;
  final int count;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    Widget card(String label, String value, int flex) => Expanded(
      flex: flex,
      child: MovoCard(
        padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(label, style: mv(13, 700, color: colors.textMuted)),
            const SizedBox(height: 8),
            FittedBox(
              fit: BoxFit.scaleDown,
              alignment: Alignment.centerLeft,
              child: Text(value, style: mv(24, 900, ls: -0.02, tabular: true)),
            ),
          ],
        ),
      ),
    );
    return Row(
      children: [
        card('오늘 수입', won(earnings), 14),
        const SizedBox(width: 10),
        card('완료', '$count건', 10),
      ],
    );
  }
}

class _TodayRow extends StatelessWidget {
  const _TodayRow(this.order);

  final Order order;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 13),
    child: Row(
      children: [
        SizedBox(
          width: 40,
          child: Text(
            clock(order.deliveredAt ?? order.requestedAt),
            style: mv(13, 700, color: context.colors.textMuted, tabular: true),
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Text(
            routeTitle(order),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: mv(15, 700),
          ),
        ),
        const SizedBox(width: 8),
        Text(
          '+${won(driverAmountOf(order))}',
          style: mv(15, 800, tabular: true),
        ),
      ],
    ),
  );
}

/// 진행 중인 배송으로 돌아가는 카드.
class _ActiveCard extends StatelessWidget {
  const _ActiveCard(this.order, {required this.onTap});

  final Order order;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Pressable(
    onTap: onTap,
    child: Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: MovoPalette.lime,
        borderRadius: BorderRadius.circular(22),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(switch (order.status) {
                  OrderStatus.pickedUp => '배송하러 가는 중',
                  OrderStatus.arrived => '픽업지에 도착',
                  OrderStatus.departed => '픽업하러 가는 중',
                  _ => '출발 전',
                }, style: mv(12, 800, color: MovoPalette.ink)),
                const SizedBox(height: 3),
                Text(
                  routeTitle(order),
                  style: mv(18, 800, ls: -0.02, color: MovoPalette.ink),
                ),
              ],
            ),
          ),
          const MovoIcon(
            MovoIcons.chevronRight,
            size: 20,
            color: MovoPalette.ink,
          ),
        ],
      ),
    ),
  );
}

/// 대기 콜 한 건. 위치는 동 단위까지만 보인다.
class CallCard extends StatelessWidget {
  const CallCard(
    this.call, {
    super.key,
    required this.highlighted,
    required this.accepting,
    required this.onTap,
    required this.onAccept,
  });

  final OpenOrder call;

  /// 맨 위의 콜 — 테두리와 수락 버튼을 강조색으로 그린다.
  final bool highlighted;
  final bool accepting;
  final VoidCallback onTap;
  final VoidCallback onAccept;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final scheduled = call.scheduledPickupAt;
    return Pressable(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: colors.surface,
          borderRadius: BorderRadius.circular(24),
          border: highlighted
              ? Border.all(
                  color: MovoPalette.lime,
                  width: 1.5,
                  strokeAlign: BorderSide.strokeAlignInside,
                )
              : null,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: scheduled == null
                  ? CrossAxisAlignment.end
                  : CrossAxisAlignment.center,
              children: [
                Expanded(
                  child: Text(
                    won(call.fare),
                    style: mv(24, 900, ls: -0.03, tabular: true),
                  ),
                ),
                if (scheduled != null)
                  MovoTag(
                    '예약 · ${_scheduleLabel(scheduled)}',
                    background: colors.surfaceMuted,
                    foreground: MovoPalette.lime,
                    padding: const EdgeInsets.symmetric(
                      horizontal: 8,
                      vertical: 5,
                    ),
                  )
                else
                  Padding(
                    padding: const EdgeInsets.only(bottom: 4),
                    child: Text(
                      timeAgo(call.requestedAt),
                      style: highlighted
                          ? mv(12, 800, color: MovoPalette.lime)
                          : mv(12, 700, color: colors.textMuted),
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 12),
            _Area(const MovoWaypointDot.pickup(size: 9), call.pickupArea),
            const SizedBox(height: 6),
            _Area(const MovoWaypointDot.dropoff(size: 9), call.dropoffArea),
            if (callAddOns(call).isNotEmpty) ...[
              const SizedBox(height: 10),
              Wrap(
                spacing: 6,
                runSpacing: 6,
                children: [
                  for (final line in callAddOns(call))
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 10,
                        vertical: 6,
                      ),
                      decoration: BoxDecoration(
                        color: colors.surfaceMuted,
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Text.rich(
                        TextSpan(
                          children: [
                            TextSpan(text: '${line.label}  '),
                            TextSpan(
                              text: line.amountText,
                              style: const TextStyle(color: MovoPalette.lime),
                            ),
                          ],
                        ),
                        style: mv(12, 800, tabular: true),
                      ),
                    ),
                ],
              ),
            ],
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: Text(
                    '${km(call.distanceKm)} · 약 ${call.durationMinutes}분 · ${cargoSummary(call.cargo)}',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: mv(13, 600, color: colors.textMuted),
                  ),
                ),
                const SizedBox(width: 8),
                MovoButton(
                  '수락',
                  onPressed: onAccept,
                  loading: accepting,
                  expand: false,
                  height: 40,
                  radius: 13,
                  fontSize: 15,
                  horizontalPadding: 20,
                  background: highlighted ? MovoPalette.lime : colors.text,
                  foreground: MovoPalette.ink,
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _Area extends StatelessWidget {
  const _Area(this.dot, this.area);

  final Widget dot;
  final String area;

  @override
  Widget build(BuildContext context) => Row(
    children: [
      SizedBox(width: 9, child: Center(child: dot)),
      const SizedBox(width: 10),
      Expanded(
        child: Text(
          area,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: mv(15, 700),
        ),
      ),
    ],
  );
}

/// 오늘 14:00 / 내일 10:00 / 10월 16일 10:00
String _scheduleLabel(DateTime at) {
  final now = DateTime.now();
  if (sameDay(at, now)) return '오늘 ${clock(at)}';
  if (sameDay(at, now.add(const Duration(days: 1)))) return '내일 ${clock(at)}';
  return monthDayClock(at);
}
