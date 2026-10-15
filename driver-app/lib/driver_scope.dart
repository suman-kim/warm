import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:movo_api/movo_api.dart';

import 'services.dart';

/// 내 기사 정보와, 운행 중에 위치를 서버에 알리는 일. 로그인해 있는 동안 하나다.
class DriverController extends ChangeNotifier {
  DriverController(this._api);

  final MovoApi _api;
  Timer? _locationTimer;
  StreamSubscription<Coordinates>? _watch;

  /// 위치 스트림이 마지막으로 알린 위치. 운행 중에만 듣는다.
  Coordinates? _watched;
  bool _disposed = false;

  Driver? _driver;
  bool _loaded = false;
  Object? _error;

  /// 내 기사 정보. 아직 등록 신청을 하지 않았으면 null.
  Driver? get driver => _driver;

  /// 서버에서 한 번이라도 받아 왔는지.
  bool get loaded => _loaded;

  /// 처음 받아 오다 실패했으면 그 오류.
  Object? get error => _error;

  /// 마지막으로 서버에 알린 위치.
  Coordinates? lastLocation;

  Future<void> refresh() async {
    try {
      set(await _api.drivers.me());
    } on Object catch (error) {
      if (_disposed) return;
      // 이미 받아 둔 값이 있으면 그대로 둔다 — 다음에 다시 받는다.
      if (!_loaded) {
        _error = error;
        notifyListeners();
      }
    }
  }

  void set(Driver? driver) {
    if (_disposed) return;
    _driver = driver;
    _loaded = true;
    _error = null;
    _syncLocationReporting();
    notifyListeners();
  }

  Future<void> setAvailability(bool available) async =>
      set(await _api.drivers.setAvailability(available));

  /// 운행 중일 때만 위치를 15초마다 알린다. 위치는 위치 스트림으로 받는다 — 길안내 앱으로 넘어가
  /// 앱이 뒤로 가도 끊기지 않는다. 운행을 켤 때는 지금 위치를 한 번 받아 바로 보낸다.
  void _syncLocationReporting() {
    final online = _driver?.available ?? false;
    if (online && _locationTimer == null) {
      _watch = locationSource.watch().listen(
        (location) => _watched = location,
        onError: (Object _) {},
      );
      unawaited(reportLocation());
      _locationTimer = Timer.periodic(
        const Duration(seconds: 15),
        (_) => _reportWatched(),
      );
    } else if (!online) {
      _stopLocationReporting();
    }
  }

  void _stopLocationReporting() {
    _locationTimer?.cancel();
    _locationTimer = null;
    unawaited(_watch?.cancel());
    _watch = null;
    _watched = null;
  }

  /// 위치 스트림이 받은 마지막 위치를 보낸다. 아직 없으면 보내지 않는다 — 여기서 위치를 직접 요청하면
  /// 위치 정확도 설정이 꺼진 기기에서 설정 창이 15초마다 뜬다.
  Future<void> _reportWatched() async {
    if (_watched case final location?) await _send(location);
  }

  /// 지금 위치를 서버에 알린다. 위치를 알 수 없으면 아무것도 하지 않는다.
  Future<Coordinates?> reportLocation() async {
    final location = await locationSource.current();
    if (location == null || _disposed) return lastLocation;
    await _send(location);
    return location;
  }

  Future<void> _send(Coordinates location) async {
    if (_disposed) return;
    lastLocation = location;
    try {
      await _api.drivers.reportLocation(location);
    } on MovoException {
      // 다음 주기에 다시 보낸다.
    }
  }

  @override
  void dispose() {
    _disposed = true;
    _stopLocationReporting();
    super.dispose();
  }
}

/// 기사 앱이 주문마다 보여 주는 금액. 배송은 매출(최종 요금, 수수료를 빼기 전),
/// 고객 취소·노쇼는 취소 보상(지금 정책은 0원)이다. 수수료를 뺀 금액은 정산 내역에서 본다.
int driverAmountOf(Order order) => switch (order.status) {
  OrderStatus.cancelled || OrderStatus.noShow => order.earning ?? 0,
  _ => order.totalFare,
};
