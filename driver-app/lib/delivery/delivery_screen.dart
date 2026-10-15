import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:movo_api/movo_api.dart';
import 'package:movo_ui/movo_ui.dart';

import '../driver_scope.dart';
import '../services.dart';
import 'stage_screens.dart';

/// 진행 중인 배송. 출발 → 픽업지 도착(대기·추가 요금·노쇼) → 픽업 → 배송 완료의 네 단계로 이어진다.
/// 수락한 뒤에야 상세 주소와 연락처, 요청사항이 보인다.
class DeliveryScreen extends StatefulWidget {
  const DeliveryScreen({
    super.key,
    required this.order,
    required this.controller,
  });

  final Order order;
  final DriverController controller;

  @override
  State<DeliveryScreen> createState() => _DeliveryScreenState();
}

class _DeliveryScreenState extends State<DeliveryScreen> {
  late Order _order = widget.order;
  bool _busy = false;

  /// 픽업지에서 넣은 추가 요금. 픽업 완료를 밀 때 함께 보낸다.
  ExtraItems _extras = ExtraItems.none;

  /// 지금 단계(1~4)와 이름.
  (int, String) get _stage => switch (_order.status) {
    OrderStatus.assigned => (1, '출발 전'),
    OrderStatus.departed => (2, '픽업지로 가는 중'),
    OrderStatus.arrived => (3, '픽업지 도착'),
    _ => (4, '배송하러 가는 중'),
  };

  Future<NavigationRoute?> _navigation() async {
    final api = context.api;
    // 지금 위치를 알면 그 위치에서, 모르면 서버가 아는 마지막 위치에서 안내한다.
    final here = await widget.controller.reportLocation();
    try {
      return await api.dispatch.navigation(_order.id, from: here);
    } on ApiException catch (error) {
      if (error.code == ApiErrorCode.locationRequired) return null;
      if (error.code == ApiErrorCode.orderNotInProgress) {
        // 그사이 고객이 취소했을 수 있다. 주문을 다시 읽어 화면을 맞춘다.
        final latest = (await api.orders.get(_order.id)).order;
        if (mounted) setState(() => _order = latest);
        return null;
      }
      rethrow;
    }
  }

  /// 다음 단계로: 출발 → 도착 → 픽업(추가 요금) → 배송 완료.
  Future<void> _advance() async {
    setState(() => _busy = true);
    final api = context.api;
    final id = _order.id;
    final next = await runAction(context, () async {
      try {
        return await switch (_order.status) {
          OrderStatus.assigned => api.dispatch.depart(id),
          OrderStatus.departed => api.dispatch.arrive(id),
          OrderStatus.arrived => api.dispatch.pickUp(id, extraItems: _extras),
          _ => api.dispatch.complete(id),
        };
      } on ApiException catch (error) {
        // 그사이 고객이 취소했으면 취소 화면으로 바꾼다.
        if (error.code == ApiErrorCode.notAssignedDriver ||
            error.statusCode == 409) {
          final latest = (await api.orders.get(id)).order;
          if (latest.status == OrderStatus.cancelled) return latest;
        }
        rethrow;
      }
    });
    if (!mounted) return;
    setState(() {
      _busy = false;
      if (next != null) _order = next;
    });
  }

  Future<void> _editExtras() async {
    final extras = await Navigator.of(context).push<ExtraItems>(
      MaterialPageRoute(
        builder: (_) => ExtrasScreen(order: _order, initial: _extras),
      ),
    );
    if (extras != null && mounted) setState(() => _extras = extras);
  }

  Future<void> _reportNoShow() async {
    final confirmed = await confirmNoShow(context, _order);
    if (!confirmed || !mounted) return;
    setState(() => _busy = true);
    final api = context.api;
    final next = await runAction(
      context,
      () => api.dispatch.reportNoShow(_order.id),
    );
    if (!mounted) return;
    setState(() {
      _busy = false;
      if (next != null) _order = next;
    });
  }

  Future<void> _call(String number) async {
    final opened = await context.launcher.call(number);
    if (!opened && mounted) {
      showMovoToast(context, '전화를 걸 수 없어요: ${phone(number)}');
    }
  }

  void _chat() => Navigator.of(context).push(
    MaterialPageRoute<void>(
      builder: (_) => OrderChatScreen(orderId: _order.id, title: '고객님'),
    ),
  );

  Future<void> _guide(Waypoint target) async {
    final opened = await routeGuide.open(
      context,
      destination: target.coordinates,
      label: streetAddress(target.address),
      vehicleType: _order.vehicleType,
    );
    if (!opened && mounted) showMovoToast(context, '지도 앱을 열 수 없어요.');
  }

  /// 고객이 고른 항목: 물품, 운반 도움, 계단.
  String _chosenItems() => [
    cargoWithWeight(_order.cargo),
    if (_order.helpFee > 0) '운반 도움 · ${loadingHelpLabel(_order.loadingHelp)}',
    if (_order.stairFee > 0)
      '계단 · ${stairsLabel(_order.pickupAccess, _order.dropoffAccess)}',
  ].join(' · ');

  @override
  Widget build(BuildContext context) {
    switch (_order.status) {
      case OrderStatus.delivered:
        return DeliveredScreen(order: _order, controller: widget.controller);
      case OrderStatus.cancelled:
        return CustomerCancelledScreen(order: _order);
      case OrderStatus.noShow:
        return NoShowDoneScreen(order: _order);
      default:
    }
    final colors = context.colors;
    final (step, stepLabel) = _stage;
    final pickedUp = _order.status == OrderStatus.pickedUp;
    final arrived = _order.status == OrderStatus.arrived;
    final target = pickedUp ? _order.dropoff : _order.pickup;
    final top = MediaQuery.paddingOf(context).top;
    // 아래 패널은 디자인대로 지도 아래 정해진 자리에서 시작한다. 화면이 낮으면 단계·밀어서 버튼이
    // 들어가도록 그만큼 올린다 (가운데 내용은 패널 안에서 스크롤된다).
    final panelTop = math.min(
      top + (arrived ? 300 : 380),
      MediaQuery.sizeOf(context).height - bottomSafeSpace(context) - 240,
    );
    return Scaffold(
      backgroundColor: colors.background,
      body: MovoAsync<NavigationRoute?>(
        // 단계가 바뀌면 목적지가 바뀌므로 새로 받는다.
        key: ValueKey(pickedUp),
        load: _navigation,
        interval: const Duration(seconds: 10),
        builder: (context, navigation) => Stack(
          children: [
            Positioned.fill(
              child: MovoMap(
                dark: true,
                zoom: 1.43,
                padding: EdgeInsets.fromLTRB(70, top + 150, 80, 440),
                route: navigation?.route ?? [target.coordinates],
                markers: [
                  if (navigation != null && navigation.route.isNotEmpty)
                    MovoMapMarker(
                      navigation.route.first,
                      Container(
                        width: 44,
                        height: 44,
                        alignment: Alignment.center,
                        decoration: BoxDecoration(
                          color: MovoPalette.lime,
                          shape: BoxShape.circle,
                          border: Border.all(
                            color: colors.background,
                            width: 4,
                          ),
                          boxShadow: const [
                            BoxShadow(
                              color: Color(0x2EC6F432),
                              spreadRadius: 10,
                            ),
                          ],
                        ),
                        child: const MovoIcon(
                          MovoIcons.navigation,
                          size: 18,
                          color: MovoPalette.ink,
                        ),
                      ),
                    ),
                  MovoMapMarker(
                    target.coordinates,
                    Container(
                      width: 24,
                      height: 24,
                      decoration: BoxDecoration(
                        color: colors.text,
                        shape: pickedUp ? BoxShape.rectangle : BoxShape.circle,
                        borderRadius: pickedUp
                            ? BorderRadius.circular(7)
                            : null,
                        border: Border.all(color: MovoPalette.lime, width: 6),
                      ),
                    ),
                  ),
                  MovoMapMarker(
                    target.coordinates,
                    Container(
                      height: 26,
                      padding: const EdgeInsets.symmetric(horizontal: 10),
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        color: colors.text,
                        borderRadius: BorderRadius.circular(13),
                      ),
                      child: Text(
                        pickedUp ? '도착' : '픽업',
                        style: mv(12, 800, color: MovoPalette.ink),
                      ),
                    ),
                    offset: const Offset(0, -32),
                  ),
                ],
              ),
            ),
            Positioned(
              top: top + 8,
              left: 14,
              right: 14,
              child: Container(
                padding: const EdgeInsets.fromLTRB(14, 12, 12, 12),
                decoration: BoxDecoration(
                  color: colors.surface,
                  borderRadius: BorderRadius.circular(22),
                  boxShadow: const [
                    BoxShadow(
                      color: Color(0x99000000),
                      blurRadius: 30,
                      spreadRadius: -12,
                      offset: Offset(0, 12),
                    ),
                  ],
                ),
                child: Row(
                  children: [
                    const MovoIconTile(
                      MovoIcons.navigation,
                      size: 46,
                      radius: 15,
                      iconSize: 20,
                      background: MovoPalette.lime,
                      foreground: MovoPalette.ink,
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            arrived
                                ? '픽업지 도착 · ${clock(_order.arrivedAt ?? DateTime.now())}'
                                : pickedUp
                                ? '도착지까지'
                                : '픽업지까지',
                            style: mv(12, 700, color: colors.textMuted),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            arrived
                                ? '물품을 받아 실어 주세요'
                                : navigation == null
                                ? '위치를 확인하는 중'
                                : step == 1
                                ? '${km(navigation.distanceKm)} · 출발하면 고객에게 알려요'
                                : '${km(navigation.distanceKm)} · 약 ${navigation.durationMinutes}분',
                            style: mv(18, 800),
                          ),
                        ],
                      ),
                    ),
                    Pressable(
                      onTap: () => _guide(target),
                      child: Container(
                        height: 38,
                        padding: const EdgeInsets.symmetric(horizontal: 14),
                        alignment: Alignment.center,
                        decoration: BoxDecoration(
                          color: colors.surfaceMuted,
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Text('길안내', style: mv(13, 800)),
                      ),
                    ),
                  ],
                ),
              ),
            ),
            Positioned(
              top: panelTop,
              left: 0,
              right: 0,
              bottom: 0,
              child: MovoBottomPanel(
                padding: EdgeInsets.fromLTRB(
                  20,
                  10,
                  20,
                  bottomSafeSpace(context),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            '$step/4 · $stepLabel',
                            style: mv(13, 800, color: MovoPalette.lime),
                          ),
                        ),
                        Text(
                          '${vehicleLabel(_order.vehicleType)} · ${won(_order.totalFare)}',
                          style: mv(13, 800, color: colors.textMuted),
                        ),
                      ],
                    ),
                    const SizedBox(height: 10),
                    MovoSegments(total: 4, filled: step, height: 5),
                    const SizedBox(height: 16),
                    Expanded(
                      child: SingleChildScrollView(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            Row(
                              children: [
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        streetAddress(target.address),
                                        style: mv(26, 800, ls: -0.03),
                                      ),
                                      const SizedBox(height: 4),
                                      Text(
                                        arrived
                                            ? '도착 ${clock(_order.arrivedAt ?? DateTime.now())} · 보내는 분 ${_order.pickup.contactName}'
                                            : [
                                                ?target.sigungu,
                                                ?target.dong,
                                                if (target.detailAddress !=
                                                    null)
                                                  '· ${target.detailAddress}',
                                              ].join(' '),
                                        style: mv(
                                          14,
                                          600,
                                          color: colors.textMuted,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                                if (arrived) ...[
                                  const SizedBox(width: 12),
                                  // 디자인에는 전화만 있지만, 고객과의 메시지를 계속 쓸 수 있게 둔다.
                                  _Round(MovoIcons.chat, '메시지', _chat),
                                  const SizedBox(width: 8),
                                  _Round(
                                    MovoIcons.phone,
                                    '전화',
                                    () => _call(_order.pickup.contactPhone),
                                    lime: true,
                                  ),
                                ],
                              ],
                            ),
                            const SizedBox(height: 16),
                            if (arrived)
                              _WaitingPanel(
                                order: _order,
                                extras: _extras,
                                onExtras: _editExtras,
                                onNoShow: _reportNoShow,
                              )
                            else if (!pickedUp)
                              _InfoBox([
                                _Info(
                                  '보내는 분',
                                  '${_order.pickup.contactName} · ${phone(_order.pickup.contactPhone)}',
                                  trailing: _CallButton(
                                    label: '보내는 분에게 전화',
                                    onTap: () =>
                                        _call(_order.pickup.contactPhone),
                                  ),
                                ),
                                _Info('물품 · 고객이 고른 항목', _chosenItems()),
                                if (_order.memo case final memo?)
                                  _Info('요청사항', memo),
                              ])
                            else
                              _InfoBox([
                                _Info(
                                  '받는 분',
                                  '${_order.dropoff.contactName} · ${phone(_order.dropoff.contactPhone)}',
                                  trailing: _CallButton(
                                    label: '받는 분에게 전화',
                                    onTap: () =>
                                        _call(_order.dropoff.contactPhone),
                                  ),
                                ),
                                if (_order.memo case final memo?)
                                  _Info('요청사항', memo),
                              ]),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(height: 14),
                    MovoSlideToConfirm(
                      label: switch (step) {
                        1 => '밀어서 출발',
                        2 => '밀어서 픽업지 도착',
                        3 => '밀어서 픽업 완료',
                        _ => '밀어서 배송 완료',
                      },
                      busy: _busy,
                      onConfirmed: _advance,
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _CallButton extends StatelessWidget {
  const _CallButton({required this.label, required this.onTap});

  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Semantics(
    button: true,
    label: label,
    excludeSemantics: true,
    child: Pressable(
      onTap: onTap,
      child: const MovoIconTile(
        MovoIcons.phone,
        size: 40,
        circle: true,
        background: MovoPalette.lime,
        foreground: MovoPalette.ink,
      ),
    ),
  );
}

/// 픽업지에 도착한 뒤: 흐르는 대기 시간과 대기료, 추가 요금 넣기, 노쇼 신고.
class _WaitingPanel extends StatefulWidget {
  const _WaitingPanel({
    required this.order,
    required this.extras,
    required this.onExtras,
    required this.onNoShow,
  });

  final Order order;
  final ExtraItems extras;
  final VoidCallback onExtras;
  final VoidCallback onNoShow;

  @override
  State<_WaitingPanel> createState() => _WaitingPanelState();
}

class _WaitingPanelState extends State<_WaitingPanel> {
  late final Timer _timer;

  @override
  void initState() {
    super.initState();
    _timer = Timer.periodic(const Duration(seconds: 1), (_) => setState(() {}));
  }

  @override
  void dispose() {
    _timer.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => WithChargeRules(
    builder: (context, rules) {
      final colors = context.colors;
      final order = widget.order;
      final now = DateTime.now();
      final passed = now.difference(order.arrivedAt ?? now);
      final free = rules?.freeWaitingMinutes ?? 10;
      final limit = rules?.noShowWaitMinutes ?? 30;
      final noShowAt =
          order.noShowAvailableAt ??
          (order.arrivedAt ?? now).add(Duration(minutes: limit));
      final canReport = !now.isBefore(noShowAt);
      final extraLabels = extraItemLabels(widget.extras);
      final extraFee = rules == null
          ? 0
          : widget.extras.overload * rules.overloadUnitPrice +
                widget.extras.bulky * rules.bulkyUnitPrice +
                widget.extras.stairs * rules.stairsUnitPrice;
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Container(
            padding: const EdgeInsets.fromLTRB(16, 14, 16, 14),
            decoration: BoxDecoration(
              color: colors.surfaceMuted,
              borderRadius: BorderRadius.circular(18),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            '대기 시간',
                            style: mv(12, 700, color: colors.textMuted),
                          ),
                          Text(
                            stopwatch(passed),
                            style: mv(28, 900, tabular: true),
                          ),
                        ],
                      ),
                    ),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        Text(
                          '쌓인 대기료',
                          style: mv(12, 700, color: colors.textMuted),
                        ),
                        Text(
                          won(rules?.waitingFeeOf(passed.inMinutes) ?? 0),
                          style: mv(
                            20,
                            900,
                            color: MovoPalette.lime,
                            tabular: true,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                WaitingBar(
                  minutes: passed.inSeconds / 60,
                  free: free,
                  limit: limit,
                  track: colors.separator,
                  marker: colors.text,
                ),
                const SizedBox(height: 8),
                Text(
                  '$free분 무료 후 1분에 ${won(rules?.waitingFeePerMinute ?? 500)}씩 쌓여요',
                  style: mv(12, 600, color: colors.textMuted),
                ),
              ],
            ),
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: _ActionTile(
                  title: '추가 요금 넣기',
                  subtitle: extraLabels.isEmpty
                      ? '과적 · 큰 짐 · 계단'
                      : '${extraLabels.join(' · ')} · +${won(extraFee)}',
                  highlighted: extraLabels.isNotEmpty,
                  onTap: widget.onExtras,
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: _ActionTile(
                  title: '노쇼 신고',
                  subtitle: canReport
                      ? '지금 신고할 수 있어요'
                      : '${clock(noShowAt)} 뒤 열려요',
                  onTap: canReport ? widget.onNoShow : null,
                ),
              ),
            ],
          ),
        ],
      );
    },
  );
}

class _ActionTile extends StatelessWidget {
  const _ActionTile({
    required this.title,
    required this.subtitle,
    required this.onTap,
    this.highlighted = false,
  });

  final String title;
  final String subtitle;
  final VoidCallback? onTap;
  final bool highlighted;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Semantics(
      button: true,
      enabled: onTap != null,
      child: Pressable(
        onTap: onTap,
        child: Opacity(
          opacity: onTap == null ? 0.55 : 1,
          child: Container(
            padding: const EdgeInsets.fromLTRB(14, 12, 12, 12),
            decoration: BoxDecoration(
              color: colors.surfaceMuted,
              borderRadius: BorderRadius.circular(16),
              border: highlighted
                  ? Border.all(color: MovoPalette.lime, width: 1.5)
                  : null,
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: mv(15, 800)),
                const SizedBox(height: 3),
                Text(
                  subtitle,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: mv(12, 600, color: colors.textMuted),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _Round extends StatelessWidget {
  const _Round(this.icon, this.label, this.onTap, {this.lime = false});

  final MovoIcons icon;
  final String label;
  final VoidCallback onTap;
  final bool lime;

  @override
  Widget build(BuildContext context) => Semantics(
    button: true,
    label: label,
    excludeSemantics: true,
    child: Pressable(
      onTap: onTap,
      child: MovoIconTile(
        icon,
        size: 46,
        circle: true,
        background: lime ? MovoPalette.lime : null,
        foreground: lime ? MovoPalette.ink : null,
      ),
    ),
  );
}

class _Info {
  const _Info(this.label, this.value, {this.trailing});

  final String label;
  final String value;
  final Widget? trailing;
}

class _InfoBox extends StatelessWidget {
  const _InfoBox(this.items);

  final List<_Info> items;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return MovoRows(
      radius: 18,
      color: colors.surfaceMuted,
      dividerColor: colors.separator,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
      children: [
        for (final item in items)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 10),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        item.label,
                        style: mv(12, 700, color: colors.textFaint),
                      ),
                      const SizedBox(height: 3),
                      Text(
                        item.value,
                        style: mv(15, 700, height: 1.5, tabular: true),
                      ),
                    ],
                  ),
                ),
                if (item.trailing != null) ...[
                  const SizedBox(width: 12),
                  item.trailing!,
                ],
              ],
            ),
          ),
      ],
    );
  }
}

/// 배송 완료. 매출(기본 요금·운반 도움·계단·추가 요금·대기료)이 오늘 수입에 더해진다.
class DeliveredScreen extends StatefulWidget {
  const DeliveredScreen({
    super.key,
    required this.order,
    required this.controller,
  });

  final Order order;
  final DriverController controller;

  @override
  State<DeliveredScreen> createState() => _DeliveredScreenState();
}

class _DeliveredScreenState extends State<DeliveredScreen> {
  bool _ending = false;

  Future<void> _endShift() async {
    setState(() => _ending = true);
    final navigator = Navigator.of(context);
    await runAction(context, () => widget.controller.setAvailability(false));
    if (mounted) navigator.pop();
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final order = widget.order;
    final deliveredAt = order.deliveredAt ?? DateTime.now();
    return Scaffold(
      backgroundColor: colors.background,
      body: SafeArea(
        bottom: false,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Expanded(
              child: ListView(
                padding: const EdgeInsets.fromLTRB(20, 60, 20, 24),
                children: [
                  Row(
                    children: [
                      Container(
                        width: 22,
                        height: 22,
                        alignment: Alignment.center,
                        decoration: const BoxDecoration(
                          color: MovoPalette.lime,
                          shape: BoxShape.circle,
                        ),
                        child: const MovoIcon(
                          MovoIcons.check,
                          size: 12,
                          color: MovoPalette.ink,
                        ),
                      ),
                      const SizedBox(width: 8),
                      Text('배송 완료', style: mv(15, 800)),
                    ],
                  ),
                  const SizedBox(height: 10),
                  FittedBox(
                    fit: BoxFit.scaleDown,
                    alignment: Alignment.centerLeft,
                    child: Text(
                      '+${won(order.totalFare)}',
                      style: mv(
                        58,
                        900,
                        ls: -0.05,
                        height: 1.05,
                        color: MovoPalette.lime,
                        tabular: true,
                      ),
                    ),
                  ),
                  const SizedBox(height: 10),
                  MovoAsync<Earnings>(
                    load: () {
                      final now = DateTime.now();
                      return context.api.dispatch.earnings(from: now, to: now);
                    },
                    builder: (context, earnings) => Text(
                      '오늘 수입 ${won(earnings.daily.lastOrNull?.sales ?? 0)} · ${earnings.daily.lastOrNull?.completedCount ?? 0}건 완료',
                      style: mv(15, 600, color: colors.textMuted),
                    ),
                  ),
                  const SizedBox(height: 22),
                  WithChargeRules(
                    builder: (context, rules) => MovoRows(
                      radius: 24,
                      padding: const EdgeInsets.symmetric(
                        horizontal: 18,
                        vertical: 4,
                      ),
                      children: [
                        MovoKeyValue(
                          '경로',
                          routeTitle(order),
                          verticalPadding: 13,
                        ),
                        for (final line in fareLines(order, rules))
                          Padding(
                            padding: const EdgeInsets.symmetric(vertical: 13),
                            child: Row(
                              children: [
                                Expanded(
                                  child: Text(
                                    line.label,
                                    style: mv(14, 600, color: colors.textMuted),
                                  ),
                                ),
                                Text(
                                  line.amountText,
                                  style: mv(
                                    14,
                                    700,
                                    tabular: true,
                                    color: line.addition
                                        ? MovoPalette.lime
                                        : null,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        MovoKeyValue(
                          '완료 시각',
                          clock(deliveredAt),
                          verticalPadding: 13,
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            MovoBottomBar(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  MovoButton(
                    '다음 콜 받기',
                    height: 60,
                    radius: 20,
                    onPressed: () => Navigator.of(context).pop(),
                  ),
                  const SizedBox(height: 4),
                  MovoButton(
                    '오늘 운행 종료',
                    kind: MovoButtonKind.text,
                    height: 44,
                    fontSize: 15,
                    weight: 700,
                    foreground: colors.textMuted,
                    loading: _ending,
                    onPressed: _endShift,
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
