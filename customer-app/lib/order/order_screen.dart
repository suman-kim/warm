import 'dart:async';

import 'package:flutter/material.dart';
import 'package:movo_api/movo_api.dart';
import 'package:movo_ui/movo_ui.dart';

import 'completed_view.dart';
import 'order_widgets.dart';
import 'payment_views.dart';

/// 주문 하나의 화면. 주문이 진행되는 동안 몇 초마다 새로 받아, 상태에 맞는 모습으로 바뀐다:
/// 기사 찾는 중 → (결제 실패) → 주문 상세(배차·출발·도착) → 배송 중 → 배송 완료 (또는 노쇼).
class OrderScreen extends StatefulWidget {
  const OrderScreen({super.key, required this.orderId});

  final String orderId;

  @override
  State<OrderScreen> createState() => _OrderScreenState();
}

class OrderData {
  const OrderData(this.detail, this.tracking);

  final OrderDetail detail;

  /// 배송 중일 때의 기사 위치와 도착 예정. 그 밖에는 null.
  final Tracking? tracking;

  Order get order => detail.order;
}

class _OrderScreenState extends State<OrderScreen> {
  final _reload = MovoAsyncController();

  /// 배송 완료·노쇼 화면을 닫고 주문 상세를 볼지 (평가를 건너뛰었을 때).
  bool _showDetail = false;

  @override
  void dispose() {
    _reload.dispose();
    super.dispose();
  }

  Future<OrderData> _load() async {
    final api = context.api;
    final detail = await api.orders.get(widget.orderId);
    final tracking = detail.order.status == OrderStatus.pickedUp
        ? await api.orders.tracking(widget.orderId)
        : null;
    return OrderData(detail, tracking);
  }

  Future<void> _cancel(OrderData data) async {
    final confirmed = await confirmCancel(
      context,
      order: data.order,
      payment: data.detail.payment,
    );
    if (!confirmed || !mounted) return;
    final api = context.api;
    final navigator = Navigator.of(context);
    final cancelled = await runAction(
      context,
      () => api.orders.cancel(widget.orderId),
    );
    if (cancelled == null || !mounted) return;
    final paid = data.detail.payment?.paidAmount ?? 0;
    final refund = paid - cancelled.cancellationFee;
    showMovoToast(
      context,
      paid == 0 ? '주문을 취소했어요.' : '주문을 취소했어요. ${won(refund)}을 환불해요.',
    );
    navigator.pop();
  }

  void _receipt(OrderData data) => Navigator.of(context).push(
    MaterialPageRoute<void>(builder: (_) => ReceiptScreen(detail: data.detail)),
  );

  void _extraCharge(OrderData data) => Navigator.of(context).push(
    MaterialPageRoute<void>(
      builder: (_) => ExtraChargeScreen(detail: data.detail),
    ),
  );

  void _chat(OrderData data) => Navigator.of(context).push(
    MaterialPageRoute<void>(
      builder: (_) => OrderChatScreen(
        orderId: widget.orderId,
        title: '${data.detail.driver?.name ?? ''} 기사님',
        canSend: data.order.isInProgress,
      ),
    ),
  );

  Future<void> _call(OrderData data) async {
    final number = data.detail.driver?.phone;
    if (number == null) return;
    final opened = await context.launcher.call(number);
    if (!opened && mounted) {
      showMovoToast(context, '전화를 걸 수 없어요: ${phone(number)}');
    }
  }

  @override
  Widget build(BuildContext context) => MovoAsync<OrderData>(
    controller: _reload,
    load: _load,
    interval: const Duration(seconds: 4),
    keepPolling: (data) =>
        data.order.status == OrderStatus.requested ||
        data.order.status == OrderStatus.paying ||
        data.order.isInProgress,
    builder: (context, data) => switch (data.order.status) {
      OrderStatus.requested || OrderStatus.paying => SearchingView(
        order: data.order,
        card: data.detail.payment?.card,
        onCancel: () => _cancel(data),
      ),
      OrderStatus.paymentFailed => PaymentFailedView(
        detail: data.detail,
        onRetried: _reload.reload,
      ),
      OrderStatus.pickedUp => TrackingView(
        data: data,
        onChat: () => _chat(data),
        onCall: () => _call(data),
        onExtraCharge: () => _extraCharge(data),
      ),
      OrderStatus.delivered when data.detail.canReview && !_showDetail =>
        CompletedView(
          detail: data.detail,
          onReviewed: _reload.reload,
          onSkip: () => setState(() => _showDetail = true),
          onReceipt: () => _receipt(data),
        ),
      OrderStatus.noShow when !_showDetail => NoShowView(
        detail: data.detail,
        onClose: () => setState(() => _showDetail = true),
      ),
      _ => OrderDetailView(
        data: data,
        onCancel: () => _cancel(data),
        onChat: () => _chat(data),
        onCall: () => _call(data),
        onReceipt: () => _receipt(data),
      ),
    },
  );
}

/// 기사 찾는 중. 같은 차종으로 운행 중인 기사 모두에게 요청이 갔고, 먼저 수락한 기사가 배차된다.
class SearchingView extends StatelessWidget {
  const SearchingView({
    super.key,
    required this.order,
    required this.card,
    required this.onCancel,
  });

  final Order order;

  /// 배차되면 결제할 카드
  final PaymentCard? card;
  final VoidCallback onCancel;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final top = MediaQuery.paddingOf(context).top;
    final scheduled = order.scheduledPickupAt;
    return Scaffold(
      backgroundColor: const Color(0xFFE4E2DA),
      body: Stack(
        children: [
          Positioned.fill(
            child: MovoMap(
              dark: false,
              padding: EdgeInsets.fromLTRB(40, top + 100, 40, 480),
              markers: [
                MovoMapMarker(
                  order.pickup.coordinates,
                  const MovoPulse.search(),
                ),
                MovoMapMarker(
                  order.pickup.coordinates,
                  const MovoMapPickupDot(halo: false),
                ),
              ],
            ),
          ),
          Positioned(
            top: top + 10,
            left: 0,
            right: 0,
            child: Center(
              child: Container(
                height: 36,
                padding: const EdgeInsets.symmetric(horizontal: 15),
                decoration: BoxDecoration(
                  color: colors.surface,
                  borderRadius: BorderRadius.circular(18),
                  boxShadow: const [
                    BoxShadow(
                      color: Color(0x66121212),
                      blurRadius: 20,
                      spreadRadius: -10,
                      offset: Offset(0, 8),
                    ),
                  ],
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const MovoLiveDot(),
                    const SizedBox(width: 9),
                    Text('배차 요청 중', style: mv(13, 800)),
                    const SizedBox(width: 9),
                    _Elapsed(since: order.requestedAt),
                  ],
                ),
              ),
            ),
          ),
          Positioned(
            left: 0,
            right: 0,
            bottom: 0,
            child: Container(
              padding: EdgeInsets.fromLTRB(
                20,
                24,
                20,
                MediaQuery.paddingOf(context).bottom + 20,
              ),
              decoration: BoxDecoration(
                color: colors.surface,
                borderRadius: const BorderRadius.vertical(
                  top: Radius.circular(30),
                ),
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const MovoShimmerBar(),
                  const SizedBox(height: 16),
                  Text('기사님을 찾고 있어요', style: mv(24, 800, ls: -0.025)),
                  const SizedBox(height: 8),
                  Text(
                    scheduled == null
                        ? '운행 중인 ${vehicleLabel(order.vehicleType)} 기사님 모두에게 요청을 보냈어요. 가장 먼저 수락한 기사님이 배차돼요.'
                        : '${monthDayClock(scheduled)} 픽업으로 예약했어요. 운행 중인 ${vehicleLabel(order.vehicleType)} 기사님 가운데 가장 먼저 수락한 기사님이 배차돼요.',
                    style: mv(14, 500, color: colors.textMuted, height: 1.55),
                  ),
                  const SizedBox(height: 16),
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 16,
                      vertical: 14,
                    ),
                    decoration: BoxDecoration(
                      color: colors.background,
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Column(
                      children: [
                        _SearchRow(
                          const MovoWaypointDot.pickup(size: 8),
                          shortAddress(order.pickup.address),
                        ),
                        const SizedBox(height: 10),
                        _SearchRow(
                          const MovoWaypointDot.dropoff(size: 8),
                          shortAddress(order.dropoff.address),
                        ),
                        const SizedBox(height: 10),
                        Container(
                          padding: const EdgeInsets.only(top: 10),
                          decoration: BoxDecoration(
                            border: Border(
                              top: BorderSide(color: colors.fieldBorder),
                            ),
                          ),
                          child: Row(
                            children: [
                              Expanded(
                                child: Text(
                                  '${vehicleLabel(order.vehicleType)} · ${cargoSummary(order.cargo)}',
                                  style: mv(14, 600, color: colors.textMuted),
                                ),
                              ),
                              Text(
                                won(order.fare),
                                style: mv(14, 800, tabular: true),
                              ),
                            ],
                          ),
                        ),
                        if (card case final card?) ...[
                          const SizedBox(height: 12),
                          Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Container(
                                width: 22,
                                height: 15,
                                margin: const EdgeInsets.only(top: 2),
                                decoration: BoxDecoration(
                                  color: MovoPalette.ink,
                                  borderRadius: BorderRadius.circular(3),
                                ),
                              ),
                              const SizedBox(width: 10),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(card.label, style: mv(13, 800)),
                                    const SizedBox(height: 2),
                                    Text(
                                      order.status == OrderStatus.paying
                                          ? '기사님이 수락해 결제하고 있어요.'
                                          : '아직 결제 전이에요. 지금 취소해도 요금이 나가지 않아요.',
                                      style: mv(
                                        12,
                                        600,
                                        color: colors.textMuted,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                        ],
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),
                  MovoButton(
                    '요청 취소',
                    kind: MovoButtonKind.outline,
                    height: 52,
                    radius: 16,
                    fontSize: 16,
                    weight: 700,
                    foreground: colors.textSecondary,
                    // 결제하는 동안에는 취소할 수 없다.
                    onPressed: order.status == OrderStatus.paying
                        ? null
                        : onCancel,
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _SearchRow extends StatelessWidget {
  const _SearchRow(this.dot, this.text);

  final Widget dot;
  final String text;

  @override
  Widget build(BuildContext context) => Row(
    children: [
      SizedBox(width: 12, child: Center(child: dot)),
      const SizedBox(width: 12),
      Expanded(
        child: Text(
          text,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: mv(14, 700),
        ),
      ),
    ],
  );
}

/// 요청한 뒤 흐른 시간 (0:24). 1초마다 바뀐다.
class _Elapsed extends StatefulWidget {
  const _Elapsed({required this.since});

  final DateTime since;

  @override
  State<_Elapsed> createState() => _ElapsedState();
}

class _ElapsedState extends State<_Elapsed> {
  late final Timer _timer = Timer.periodic(
    const Duration(seconds: 1),
    (_) => setState(() {}),
  );

  @override
  void initState() {
    super.initState();
    _timer;
  }

  @override
  void dispose() {
    _timer.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final passed = DateTime.now().difference(widget.since);
    final seconds = passed.isNegative ? 0 : passed.inSeconds;
    return Text(
      '${seconds ~/ 60}:${(seconds % 60).toString().padLeft(2, '0')}',
      style: mv(13, 800, color: context.colors.textMuted, tabular: true),
    );
  }
}

/// 주문 상세. 배차된 뒤 픽업 전의 모습이고, 끝난 주문을 다시 볼 때도 쓴다.
class OrderDetailView extends StatelessWidget {
  const OrderDetailView({
    super.key,
    required this.data,
    required this.onCancel,
    required this.onChat,
    required this.onCall,
    required this.onReceipt,
  });

  final OrderData data;
  final VoidCallback onCancel;
  final VoidCallback onChat;
  final VoidCallback onCall;
  final VoidCallback onReceipt;

  /// 취소 버튼 위의 안내: 지금 취소하면 얼마를 돌려받는지.
  static String _cancelNote(Order order, OrderPayment? payment) {
    final fee = order.cancellationFeeNow ?? 0;
    final paid = payment?.paidAmount ?? 0;
    if (paid == 0) return '아직 결제 전이라 지금 취소해도 요금이 나가지 않아요';
    if (fee == 0) return '기사님 출발 전이라 지금 취소하면 전액 환불돼요';
    final percent = (fee * 100 / order.fare).round();
    return '지금 취소하면 수수료 $percent% ${won(fee)}을 뺀 ${won(paid - fee)}이 환불돼요';
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final order = data.order;
    final driver = data.detail.driver;
    final review = data.detail.review;
    final payment = data.detail.payment;
    final (tag, headline, sub) = _status(order);
    return MovoPage(
      title: '주문 상세',
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
      bottom: order.isCancellable
          ? Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  _cancelNote(order, payment),
                  textAlign: TextAlign.center,
                  style: mv(12, 600, color: colors.textMuted),
                ),
                const SizedBox(height: 10),
                MovoButton(
                  '주문 취소',
                  kind: MovoButtonKind.outline,
                  background: colors.surface,
                  height: 54,
                  radius: 16,
                  fontSize: 16,
                  onPressed: onCancel,
                ),
              ],
            )
          : null,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          MovoCard(
            radius: 24,
            padding: const EdgeInsets.fromLTRB(18, 20, 18, 18),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                MovoTag(
                  tag,
                  background: order.isInProgress
                      ? MovoPalette.lime
                      : colors.surfaceMuted,
                  foreground: MovoPalette.ink,
                ),
                const SizedBox(height: 8),
                Text(headline, style: mv(22, 800, ls: -0.025)),
                if (sub != null) ...[
                  const SizedBox(height: 8),
                  Text(sub, style: mv(14, 600, color: colors.textMuted)),
                ],
                const SizedBox(height: 18),
                OrderTimeline(order),
              ],
            ),
          ),
          if (order.status == OrderStatus.arrived &&
              order.arrivedAt != null) ...[
            const SizedBox(height: 12),
            WaitingCard(arrivedAt: order.arrivedAt!),
          ],
          if (driver != null) ...[
            const SizedBox(height: 12),
            DriverCard(
              driver,
              onChat: onChat,
              onCall: order.isInProgress ? onCall : null,
            ),
          ],
          if (payment != null) ...[
            const SizedBox(height: 12),
            PaymentInfoCard(
              order: order,
              payment: payment,
              onReceipt: onReceipt,
            ),
          ],
          const SizedBox(height: 12),
          MovoRows(
            padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 4),
            children: [
              MovoKeyValue('출발', shortAddress(order.pickup.address)),
              MovoKeyValue('도착', shortAddress(order.dropoff.address)),
              MovoKeyValue('물품', cargoWithWeight(order.cargo)),
              MovoKeyValue(
                '받는 분',
                '${order.dropoff.contactName} · ${phone(order.dropoff.contactPhone)}',
                tabular: true,
              ),
              if (order.memo case final memo?) MovoKeyValue('요청사항', memo),
              if (order.scheduledPickupAt case final at?)
                MovoKeyValue('예약 픽업', monthDayClock(at)),
              MovoKeyValue('주문번호', order.code, tabular: true),
              if (review != null) MovoKeyValue('내 평가', '별점 ${review.rating}점'),
            ],
          ),
        ],
      ),
    );
  }

  /// 상태에 맞는 꼬리표, 제목, 설명.
  static (String, String, String?) _status(Order order) {
    switch (order.status) {
      case OrderStatus.assigned:
        final assigned = order.assignedAt;
        return (
          '배차 완료',
          '기사님이 곧 출발해요',
          '${assigned == null ? '' : '배차 ${clock(assigned)} · '}출발하면 알려드려요',
        );
      case OrderStatus.departed:
        final departed = order.departedAt;
        final eta = order.estimatedPickupAt;
        return (
          '기사 출발',
          '기사님이 픽업지로 오고 있어요',
          [
            if (departed != null) '출발 ${clock(departed)}',
            if (eta != null) '도착 예정 ${clock(eta)}',
          ].join(' · '),
        );
      case OrderStatus.arrived:
        final arrived = order.arrivedAt;
        return (
          '픽업지 도착',
          '기사님이 픽업지에 도착했어요',
          '${arrived == null ? '' : '도착 ${clock(arrived)} · '}물품을 기사님께 전해 주세요',
        );
      case OrderStatus.noShow:
        final at = order.noShowAt;
        return (
          '노쇼',
          '노쇼로 처리된 주문이에요',
          at == null ? null : '${monthDayClock(at)} 노쇼 처리',
        );
      case OrderStatus.paymentFailed:
        return ('결제 실패', '결제가 안 돼 배차되지 않았어요', null);
      case OrderStatus.pickedUp:
        return ('배송 중', '물품을 싣고 이동 중이에요', null);
      case OrderStatus.delivered:
        final at = order.deliveredAt;
        return (
          '배송 완료',
          '배송이 완료됐어요',
          at == null ? null : '${monthDayClock(at)} 도착',
        );
      case OrderStatus.cancelled:
        final at = order.cancelledAt;
        return (
          '취소',
          '취소한 주문이에요',
          order.cancelReason ?? (at == null ? null : '${monthDayClock(at)} 취소'),
        );
      case OrderStatus.requested || OrderStatus.paying || OrderStatus.unknown:
        return ('배차 요청 중', '기사님을 찾고 있어요', null);
    }
  }
}

/// 배송 중. 지도에서 기사 위치를 보고, 도착 예정을 확인한다.
class TrackingView extends StatelessWidget {
  const TrackingView({
    super.key,
    required this.data,
    required this.onChat,
    required this.onCall,
    required this.onExtraCharge,
  });

  final OrderData data;
  final VoidCallback onChat;
  final VoidCallback onCall;

  /// 픽업할 때 붙은 추가 요금 안내를 연다.
  final VoidCallback onExtraCharge;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final order = data.order;
    final driver = data.detail.driver;
    final top = MediaQuery.paddingOf(context).top;
    final location = data.tracking?.driverLocation?.coordinates;
    final eta = data.tracking?.estimatedDeliveryAt ?? order.estimatedDeliveryAt;
    final pickup = order.pickup.coordinates;
    final dropoff = order.dropoff.coordinates;
    return Scaffold(
      backgroundColor: colors.surface,
      body: Stack(
        children: [
          Positioned(
            top: 0,
            left: 0,
            right: 0,
            height: top + 430,
            child: MovoMap(
              dark: false,
              padding: EdgeInsets.fromLTRB(70, top + 110, 80, 90),
              // 기사 위치를 알면 지나온 길과 남은 길을 나눠 그린다.
              traveled: location == null ? const [] : [pickup, location],
              route: [location ?? pickup, dropoff],
              markers: [
                if (location != null)
                  MovoMapMarker(
                    pickup,
                    Container(
                      width: 12,
                      height: 12,
                      decoration: BoxDecoration(
                        color: const Color(0xFFA9A9A3),
                        shape: BoxShape.circle,
                        border: Border.all(color: MovoPalette.white, width: 2),
                      ),
                    ),
                  ),
                if (order.pickedUpAt case final at?)
                  MovoMapMarker(
                    pickup,
                    Container(
                      height: 26,
                      padding: const EdgeInsets.symmetric(horizontal: 10),
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        color: MovoPalette.white,
                        borderRadius: BorderRadius.circular(13),
                        boxShadow: const [
                          BoxShadow(
                            color: Color(0x59121212),
                            blurRadius: 16,
                            spreadRadius: -8,
                            offset: Offset(0, 6),
                          ),
                        ],
                      ),
                      child: Text(
                        '픽업 완료 ${clock(at)}',
                        style: mv(12, 700, color: const Color(0xFF6B6B66)),
                      ),
                    ),
                    offset: const Offset(0, -30),
                  ),
                MovoMapMarker(dropoff, const MovoMapDropoffDot(size: 16)),
                MovoMapMarker(
                  dropoff,
                  MovoMapLabel(
                    eta == null ? placeName(order.dropoff) : clock(eta),
                    prefix: '도착',
                    inverse: true,
                  ),
                  offset: const Offset(0, -30),
                ),
                if (location != null) ...[
                  MovoMapMarker(location, const MovoPulse.ping()),
                  MovoMapMarker(
                    location,
                    Container(
                      width: 44,
                      height: 44,
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        color: MovoPalette.ink,
                        shape: BoxShape.circle,
                        border: Border.all(color: MovoPalette.white, width: 3),
                        boxShadow: const [
                          BoxShadow(
                            color: Color(0x80121212),
                            blurRadius: 18,
                            spreadRadius: -6,
                            offset: Offset(0, 8),
                          ),
                        ],
                      ),
                      child: MovoIcon(
                        order.vehicleType == VehicleType.motorcycle
                            ? MovoIcons.motorcycle
                            : MovoIcons.van,
                        size: 20,
                        color: MovoPalette.white,
                      ),
                    ),
                  ),
                ],
              ],
            ),
          ),
          Positioned(top: top + 6, left: 20, child: const MovoFloatingBack()),
          Positioned(
            top: top + 402,
            left: 0,
            right: 0,
            bottom: 0,
            child: MovoBottomPanel(
              padding: const EdgeInsets.fromLTRB(20, 10, 20, 0),
              child: ListView(
                padding: EdgeInsets.only(
                  bottom: MediaQuery.paddingOf(context).bottom + 20,
                ),
                children: [
                  Text(
                    '물품을 싣고 이동 중이에요',
                    style: mv(14, 700, color: colors.accentText),
                  ),
                  const SizedBox(height: 4),
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.baseline,
                    textBaseline: TextBaseline.alphabetic,
                    children: [
                      Text(
                        eta == null ? '이동 중' : '${minutesUntil(eta)}분 후 도착',
                        style: mv(30, 900, ls: -0.035),
                      ),
                      if (eta != null) ...[
                        const SizedBox(width: 8),
                        Text(
                          '${clock(eta)} 예정',
                          style: mv(14, 600, color: colors.textMuted),
                        ),
                      ],
                    ],
                  ),
                  const SizedBox(height: 16),
                  const MovoSegments(total: 3, filled: 2),
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          '배차 ${order.assignedAt == null ? '' : clock(order.assignedAt!)}',
                          style: mv(12, 700),
                        ),
                      ),
                      const SizedBox(width: 4),
                      Expanded(
                        child: Text(
                          '픽업 ${order.pickedUpAt == null ? '' : clock(order.pickedUpAt!)}',
                          style: mv(12, 700),
                        ),
                      ),
                      const SizedBox(width: 4),
                      Expanded(
                        child: Text(
                          '도착',
                          style: mv(12, 700, color: colors.textMuted),
                        ),
                      ),
                    ],
                  ),
                  if (order.additionalFare > 0) ...[
                    const SizedBox(height: 16),
                    Pressable(
                      onTap: onExtraCharge,
                      child: Container(
                        padding: const EdgeInsets.fromLTRB(14, 12, 10, 12),
                        decoration: BoxDecoration(
                          color: MovoPalette.lime,
                          borderRadius: BorderRadius.circular(16),
                        ),
                        child: Row(
                          children: [
                            const MovoIcon(
                              MovoIcons.plus,
                              size: 16,
                              color: MovoPalette.ink,
                            ),
                            const SizedBox(width: 10),
                            Expanded(
                              child: Text(
                                (data.detail.payment?.additionalCharge == null)
                                    ? '추가 요금 ${won(order.additionalFare)}을 결제하지 못했어요'
                                    : '추가 요금 ${won(order.additionalFare)}이 결제됐어요',
                                style: mv(14, 800, color: MovoPalette.ink),
                              ),
                            ),
                            const MovoIcon(
                              MovoIcons.chevronRight,
                              size: 18,
                              color: MovoPalette.ink,
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                  if (driver != null) ...[
                    const SizedBox(height: 16),
                    DriverCard(
                      driver,
                      onChat: onChat,
                      onCall: onCall,
                      onSurface: true,
                    ),
                  ],
                  const SizedBox(height: 16),
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 4),
                    child: Row(
                      children: [
                        MovoIcon(
                          MovoIcons.box,
                          size: 16,
                          color: colors.textMuted,
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            [
                              cargoSummary(order.cargo),
                              ?order.memo,
                            ].join(' · '),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: mv(13, 600, color: colors.textMuted),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
