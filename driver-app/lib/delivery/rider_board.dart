import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:movo_api/movo_api.dart';

import 'rider_format.dart';

/// 내가 맡은 배달. 셸이 하나 들고 몇 초마다 새로 받는다 — 홈의 '진행 중 n/3', 진행 중 탭,
/// 배달 진행 화면이 모두 이 값을 본다. 진행 중이던 배달을 가게가 취소하면 [onCancelled]로 알린다.
class RiderBoard extends ChangeNotifier {
  RiderBoard(this._api);

  final MovoApi _api;
  Timer? _timer;
  bool _disposed = false;
  bool _loading = false;

  List<Order> _orders = const [];
  bool _loaded = false;

  /// 지난번에 진행 중이던 배달.
  Set<String> _activeIds = const {};

  /// 진행 중이던 배달이 취소되면 부른다 (가게가 취소함).
  void Function(Order order)? onCancelled;

  bool get loaded => _loaded;

  /// 최근에 맡은 배달 (최근 것부터).
  List<Order> get orders => _orders;

  /// 진행 중인 배달 (먼저 수락한 것부터).
  List<Order> get active {
    final list = [
      for (final order in _orders)
        if (order.isInProgress) order,
    ];
    list.sort(
      (a, b) => (a.assignedAt ?? a.requestedAt).compareTo(
        b.assignedAt ?? b.requestedAt,
      ),
    );
    return list;
  }

  /// 더 수락할 수 없는지.
  bool get full => active.length >= maxActiveDeliveries;

  /// 다음에 이어 갈 배달: 배달 중 → 가게 도착 → 가게로 이동.
  Order? get next {
    final list = active;
    if (list.isEmpty) return null;
    list.sort(
      (a, b) => nextPriority(a.status).compareTo(nextPriority(b.status)),
    );
    return list.first;
  }

  /// 같은 가게에서 함께 맡은 다른 진행 중 배달.
  List<Order> sameStore(Order order) => [
    for (final other in active)
      if (other.id != order.id &&
          other.storeDelivery.storeId == order.storeDelivery.storeId)
        other,
  ];

  Order? byId(String id) => _orders.where((o) => o.id == id).firstOrNull;

  void start({Duration every = const Duration(seconds: 8)}) {
    _timer?.cancel();
    _timer = Timer.periodic(every, (_) => refresh());
    unawaited(refresh());
  }

  void stop() {
    _timer?.cancel();
    _timer = null;
  }

  Future<void> refresh() async {
    if (_loading) return;
    _loading = true;
    try {
      final page = await _api.dispatch.myOrders(size: 30);
      if (_disposed) return;
      _apply(page.items);
    } on Object {
      // 다음 주기에 다시 받는다.
    } finally {
      _loading = false;
    }
  }

  /// 방금 바뀐 배달(수락·도착·픽업·완료한 응답)을 바로 반영한다.
  void put(Order order) {
    final rest = [
      for (final o in _orders)
        if (o.id != order.id) o,
    ];
    _apply([order, ...rest]);
  }

  void _apply(List<Order> orders) {
    _orders = orders;
    _loaded = true;
    final now = {
      for (final o in orders)
        if (o.isInProgress) o.id,
    };
    for (final order in orders) {
      if (_activeIds.contains(order.id) &&
          order.status == OrderStatus.cancelled) {
        onCancelled?.call(order);
      }
    }
    _activeIds = now;
    notifyListeners();
  }

  @override
  void dispose() {
    _disposed = true;
    stop();
    super.dispose();
  }
}
