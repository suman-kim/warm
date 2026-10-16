import '../api_exception.dart';
import '../api_transport.dart';
import '../json.dart';
import '../models/enums.dart';
import '../models/order.dart';
import '../models/paged.dart';

/// 가게의 배달 조회와 취소 (가게 앱). 배달 상세·추적은 배차된 라이더도 쓴다.
/// 배달 요청은 `deliveries`로 한다.
class OrdersApi {
  OrdersApi(this._transport);

  final ApiTransport _transport;

  String _path(String orderId, [String rest = '']) =>
      '/orders/${Uri.encodeComponent(orderId)}$rest';

  /// 우리 가게의 배달 목록 (최근 요청순). 배차된 배달에는 라이더 이름([Order.driverName])이 붙는다.
  ///
  /// [from]과 [to]를 함께 주면 그 기간(두 시각이 속한 한국 날짜, 양 끝 포함)에 요청한 것만 온다.
  Future<Paged<Order>> list({
    OrderStatus? status,
    DateTime? from,
    DateTime? to,
    int page = 1,
    int size = 20,
  }) async {
    if ((from == null) != (to == null)) {
      throw ArgumentError('from과 to는 함께 줘야 해요');
    }
    return parseResponse(
      await _transport.send(
        'GET',
        '/orders',
        query: {
          'status': status?.wire,
          'from': from == null ? null : toKstDate(from),
          'to': to == null ? null : toKstDate(to),
          'page': page,
          'size': size,
        },
      ),
      (json) => Paged.fromJson(json, Order.fromJson),
    );
  }

  /// 최근 배달한 곳. 지난 배달의 손님 주소를 최근 순으로, 주소별로 한 번씩 준다.
  Future<List<RecentDestination>> recentDestinations({int limit = 5}) async =>
      parseListResponse(
        await _transport.send(
          'GET',
          '/orders/recent-destinations',
          query: {'limit': limit},
        ),
        RecentDestination.fromJson,
      );

  /// 배달 상세. 요청한 가게와 배차된 라이더만 볼 수 있다 — 그 밖에는 [ApiErrorCode.orderNotFound].
  Future<OrderDetail> get(String orderId) async => parseResponse(
    await _transport.send('GET', _path(orderId)),
    OrderDetail.fromJson,
  );

  /// 배달 추적. 라이더의 현재 위치와, 그 위치에서 다시 어림한 픽업·도착 예정 시각.
  /// 배달 중 화면에서 주기적으로 부른다.
  Future<Tracking> tracking(String orderId) async => parseResponse(
    await _transport.send('GET', _path(orderId, '/tracking')),
    Tracking.fromJson,
  );

  /// 배달 취소. 대행료를 충전금으로 돌려준다 — 라이더가 출발한 뒤면 수수료
  /// ([Order.cancellationFeeNow])를 뺀다. 라이더가 픽업한 뒤에는 [ApiErrorCode.orderNotCancellable].
  Future<Order> cancel(String orderId, {String? reason}) async => parseResponse(
    await _transport.send(
      'POST',
      _path(orderId, '/cancel'),
      body: {'reason': ?reason},
    ),
    Order.fromJson,
  );
}
