import 'package:flutter/material.dart';
import 'package:movo_api/movo_api.dart';
import 'package:movo_ui/movo_ui.dart';

import '../order/delivery_info_screen.dart';
import '../order/draft.dart';
import '../order/order_screen.dart';
import '../places.dart';
import 'address_search_screen.dart';

/// 홈. 퀵 배송과 화물 운송 중 서비스만 고르면 주소 입력(1단계)으로 넘어간다.
/// 최근 보낸 경로를 누르면 같은 출발지·도착지와 받는 분으로 배송 정보(2단계)부터 시작한다.
class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key, this.controller});

  /// 탭으로 돌아왔을 때 최근 보낸 경로와 알림 수를 새로 받게 한다.
  final MovoAsyncController? controller;

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeData {
  const _HomeData(this.routes, this.unread);

  /// 최근에 끝난 배송 — 출발지와 도착지가 같은 것은 한 번만, 세 개까지.
  final List<Order> routes;
  final int unread;
}

/// 서비스 카드에 적는 차종. 서버의 차종별 서비스와 같다.
const _quickVehicles = [
  VehicleType.motorcycle,
  VehicleType.damas,
  VehicleType.labo,
];
const _freightVehicles = [
  VehicleType.truck1Ton,
  VehicleType.truck2HalfTon,
  VehicleType.truck5Ton,
];

class _HomeScreenState extends State<HomeScreen> {
  late final _reload = widget.controller ?? MovoAsyncController();

  @override
  void dispose() {
    if (widget.controller == null) _reload.dispose();
    super.dispose();
  }

  Future<_HomeData> _load() async {
    final api = context.api;
    final (orders, unread) = await (
      api.orders.list(size: 20),
      api.notifications.unreadCount(),
    ).wait;
    final seen = <String>{};
    final routes = [
      for (final order in orders.items)
        if (const [
              OrderStatus.delivered,
              OrderStatus.cancelled,
              OrderStatus.noShow,
            ].contains(order.status) &&
            seen.add('${order.pickup.address}>${order.dropoff.address}'))
          order,
    ].take(3).toList();
    return _HomeData(routes, unread);
  }

  OrderDraft _draft(ServiceType service, Place pickup, Place dropoff) {
    final user = context.session.user!;
    return OrderDraft(
      service: service,
      pickup: pickup,
      dropoff: dropoff,
      senderName: user.name,
      senderPhone: user.phone,
    );
  }

  /// 서비스를 고르면 주소 입력부터. 두 곳을 고르면 그 화면이 배송 정보로 바뀐다
  /// (배송 정보에서 뒤로 가면 홈이다).
  Future<void> _start(ServiceType service) async {
    await Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => AddressSearchScreen(
          service: service,
          onComplete: (context, pickup, dropoff) =>
              Navigator.of(context).pushReplacement(
                MaterialPageRoute<void>(
                  builder: (_) => DeliveryInfoScreen(
                    draft: _draft(service, pickup, dropoff),
                  ),
                ),
              ),
        ),
      ),
    );
    _reload.reload();
  }

  /// 지난 배송과 같은 경로·차종·받는 분으로 배송 정보부터 다시 시작한다.
  Future<void> _resend(Order order) async {
    final draft =
        _draft(
            order.serviceType,
            Place.fromWaypoint(order.pickup),
            Place.fromWaypoint(order.dropoff),
          )
          ..receiverName = order.dropoff.contactName
          ..receiverPhone = order.dropoff.contactPhone
          ..vehicleType = order.vehicleType;
    await Navigator.of(context).push(
      MaterialPageRoute<void>(builder: (_) => DeliveryInfoScreen(draft: draft)),
    );
    _reload.reload();
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final user = context.session.user;
    return SafeArea(
      bottom: false,
      child: MovoAsync<_HomeData>(
        controller: _reload,
        load: _load,
        builder: (context, data) => ListView(
          padding: const EdgeInsets.fromLTRB(20, 10, 20, 24),
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const MovoLogo(size: 26),
                _Bell(
                  unread: data.unread > 0,
                  onTap: () async {
                    await Navigator.of(context).push(
                      MaterialPageRoute<void>(
                        builder: (_) => NotificationsScreen(
                          onOpenOrder: (context, orderId) =>
                              Navigator.of(context).push(
                                MaterialPageRoute<void>(
                                  builder: (_) => OrderScreen(orderId: orderId),
                                ),
                              ),
                        ),
                      ),
                    );
                    _reload.reload();
                  },
                ),
              ],
            ),
            const SizedBox(height: 20),
            Text(
              '안녕하세요, ${_givenName(user?.name ?? '')}님',
              style: mv(15, 600, color: colors.textMuted),
            ),
            const SizedBox(height: 8),
            Text(
              '어떤 배송이\n필요하세요?',
              style: mv(30, 800, ls: -0.035, height: 1.28),
            ),
            const SizedBox(height: 20),
            Row(
              children: [
                Expanded(
                  child: _ServiceCard(
                    icon: MovoIcons.motorcycle,
                    title: '퀵 배송',
                    vehicles: _quickVehicles,
                    uses: '서류 · 박스',
                    dark: false,
                    onTap: () => _start(ServiceType.quick),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: _ServiceCard(
                    icon: MovoIcons.truck,
                    title: '화물 운송',
                    vehicles: _freightVehicles,
                    uses: '이사 · 대형 화물',
                    dark: true,
                    onTap: () => _start(ServiceType.freight),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 20),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 4),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('최근 보낸 경로', style: mv(17, 800, ls: -0.02)),
                  const SizedBox(height: 3),
                  Text(
                    '누르면 같은 출발지와 도착지로 바로 보내요',
                    style: mv(13, 600, color: colors.textMuted),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 12),
            if (data.routes.isEmpty)
              Container(
                padding: const EdgeInsets.symmetric(vertical: 22),
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: colors.surface,
                  borderRadius: BorderRadius.circular(24),
                ),
                child: Text(
                  '아직 보낸 배송이 없어요',
                  style: mv(14, 600, color: colors.textMuted),
                ),
              )
            else
              MovoRows(
                radius: 24,
                padding: const EdgeInsets.symmetric(
                  horizontal: 16,
                  vertical: 4,
                ),
                children: [
                  for (final order in data.routes)
                    _RecentRoute(order, onTap: () => _resend(order)),
                ],
              ),
          ],
        ),
      ),
    );
  }
}

/// 한글 이름이면 성을 뗀다: 김지은 → 지은.
String _givenName(String name) =>
    RegExp(r'^[가-힣]{3,4}$').hasMatch(name) ? name.substring(1) : name;

class _Bell extends StatelessWidget {
  const _Bell({required this.unread, required this.onTap});

  final bool unread;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Semantics(
    button: true,
    label: unread ? '알림, 안 읽은 알림 있음' : '알림',
    excludeSemantics: true,
    child: Pressable(
      onTap: onTap,
      child: SizedBox(
        width: 42,
        height: 42,
        child: Stack(
          children: [
            Container(
              decoration: BoxDecoration(
                color: context.colors.surface,
                shape: BoxShape.circle,
              ),
              alignment: Alignment.center,
              child: const MovoIcon(MovoIcons.bell, size: 20),
            ),
            if (unread)
              Positioned(
                top: 9,
                right: 10,
                child: Container(
                  width: 12,
                  height: 12,
                  decoration: BoxDecoration(
                    color: MovoPalette.lime,
                    shape: BoxShape.circle,
                    border: Border.all(color: MovoPalette.ink, width: 2),
                  ),
                ),
              ),
          ],
        ),
      ),
    ),
  );
}

/// 서비스 카드 — 누르면 그 서비스로 주소 입력을 시작한다. 퀵은 라임, 화물은 잉크 바탕.
class _ServiceCard extends StatelessWidget {
  const _ServiceCard({
    required this.icon,
    required this.title,
    required this.vehicles,
    required this.uses,
    required this.dark,
    required this.onTap,
  });

  final MovoIcons icon;
  final String title;
  final List<VehicleType> vehicles;

  /// 무엇을 보내는지 (서류 · 박스)
  final String uses;
  final bool dark;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final foreground = dark ? MovoPalette.white : MovoPalette.ink;
    final sub = dark ? const Color(0xFFA5A5A0) : const Color(0xFF3B4710);
    // 1톤 트럭 · 2.5톤 트럭 → 1톤 · 2.5톤
    final names = vehicles
        .map((type) => vehicleLabel(type).replaceAll(' 트럭', ''))
        .join(' · ');
    return Semantics(
      button: true,
      label: '$title, $names',
      excludeSemantics: true,
      child: Pressable(
        onTap: onTap,
        child: Container(
          height: 196,
          padding: const EdgeInsets.fromLTRB(18, 18, 18, 20),
          decoration: BoxDecoration(
            color: dark ? MovoPalette.ink : MovoPalette.lime,
            borderRadius: BorderRadius.circular(28),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  MovoIconTile(
                    icon,
                    size: 54,
                    iconSize: 26,
                    radius: 18,
                    background: dark ? MovoPalette.lime : MovoPalette.ink,
                    foreground: dark ? MovoPalette.ink : MovoPalette.lime,
                  ),
                  Container(
                    width: 34,
                    height: 34,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      color: dark
                          ? const Color(0x1FFFFFFF)
                          : const Color(0x14121212),
                      shape: BoxShape.circle,
                    ),
                    child: MovoIcon(
                      MovoIcons.chevronRight,
                      size: 18,
                      color: foreground,
                    ),
                  ),
                ],
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title, style: mv(23, 800, ls: -0.03, color: foreground)),
                  const SizedBox(height: 6),
                  for (final line in [names, uses])
                    Text(
                      line,
                      maxLines: 1,
                      softWrap: false,
                      overflow: TextOverflow.fade,
                      style: mv(12, 600, ls: -0.02, height: 1.5, color: sub),
                    ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// 최근 보낸 경로 한 줄: 날짜·서비스·차종, 출발지와 도착지, 다시 보내기.
class _RecentRoute extends StatelessWidget {
  const _RecentRoute(this.order, {required this.onTap});

  final Order order;
  final VoidCallback onTap;

  /// 망원동 망원로 52. 읍·면 주소는 도로명 앞에 이미 읍·면이 있어 덧붙이지 않는다
  /// (남양읍 남양성지로 112).
  static String _place(Waypoint waypoint) {
    final street = streetAddress(waypoint.address);
    final dong = waypoint.dong;
    return dong == null || street.startsWith(dong) ? street : '$dong $street';
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final meta = [
      monthDay(order.requestedAt),
      serviceLabel(order.serviceType),
      vehicleLabel(order.vehicleType),
    ].join(' · ');
    Text place(Waypoint waypoint) => Text(
      _place(waypoint),
      maxLines: 1,
      overflow: TextOverflow.ellipsis,
      style: mv(15, 700),
    );
    return Semantics(
      button: true,
      label:
          '$meta, ${_place(order.pickup)}에서 ${_place(order.dropoff)}로 다시 보내기',
      excludeSemantics: true,
      child: Pressable(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 16),
          child: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(meta, style: mv(12, 700, color: colors.textMuted)),
                    const SizedBox(height: 10),
                    Row(
                      children: [
                        const SizedBox(
                          width: 12,
                          child: Center(child: MovoWaypointDot.pickup(size: 9)),
                        ),
                        const SizedBox(width: 12),
                        Expanded(child: place(order.pickup)),
                      ],
                    ),
                    Padding(
                      padding: const EdgeInsets.symmetric(vertical: 3),
                      child: SizedBox(
                        width: 12,
                        child: Center(
                          child: Container(
                            width: 2,
                            height: 14,
                            color: colors.fieldBorder,
                          ),
                        ),
                      ),
                    ),
                    Row(
                      children: [
                        const SizedBox(
                          width: 12,
                          child: Center(
                            child: MovoWaypointDot.dropoff(size: 10),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(child: place(order.dropoff)),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 14),
              Container(
                height: 34,
                padding: const EdgeInsets.symmetric(horizontal: 12),
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: colors.surfaceSunken,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Text('다시 보내기', style: mv(13, 800)),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
