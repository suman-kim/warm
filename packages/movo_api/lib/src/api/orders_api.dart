import '../api_exception.dart';
import '../api_transport.dart';
import '../json.dart';
import '../models/coordinates.dart';
import '../models/enums.dart';
import '../models/inputs.dart';
import '../models/order.dart';
import '../models/paged.dart';
import '../models/payment.dart';

/// 배송 요청과 조회 (고객 앱). 주문 상세·추적·메시지는 배차된 기사도 쓴다.
class OrdersApi {
  OrdersApi(this._transport);

  final ApiTransport _transport;

  String _path(String orderId, [String rest = '']) =>
      '/orders/${Uri.encodeComponent(orderId)}$rest';

  /// 요금 견적. 거리·예상 시간·경로와 차종별 요금을 한 번에 준다.
  ///
  /// [serviceType]을 주면 그 서비스(퀵 또는 화물)의 차종만 온다.
  Future<FareEstimates> estimates({
    required Coordinates pickup,
    required Coordinates dropoff,
    ServiceType? serviceType,
  }) async => parseResponse(
    await _transport.send(
      'POST',
      '/orders/estimates',
      body: {
        'pickup': pickup.toJson(),
        'dropoff': dropoff.toJson(),
        'serviceType': ?serviceType?.wire,
      },
    ),
    FareEstimates.fromJson,
  );

  /// 배송 요청. 배차 대기 상태의 주문이 만들어지고, 그 차종의 운행 중인 기사들에게 알림이 간다.
  /// 결제는 기사가 수락할 때 [paymentMethodId](없으면 기본 카드)로 한다.
  ///
  /// 화물이 차종 한도보다 무거우면 [ApiErrorCode.cargoTooHeavy],
  /// 등록한 카드가 없거나 고른 카드를 쓸 수 없으면 [ApiErrorCode.paymentMethodRequired].
  Future<Order> create({
    required VehicleType vehicleType,
    required WaypointInput pickup,
    required WaypointInput dropoff,
    required CargoInput cargo,
    String? memo,
    DateTime? scheduledPickupAt,
    LoadingHelp loadingHelp = LoadingHelp.none,
    FloorAccess pickupAccess = FloorAccess.ground,
    FloorAccess dropoffAccess = FloorAccess.ground,
    String? paymentMethodId,
  }) async => parseResponse(
    await _transport.send(
      'POST',
      '/orders',
      body: {
        'vehicleType': vehicleType.wire,
        'pickup': pickup.toJson(),
        'dropoff': dropoff.toJson(),
        'cargo': cargo.toJson(),
        'memo': ?memo,
        'scheduledPickupAt': ?(scheduledPickupAt == null
            ? null
            : toWireDate(scheduledPickupAt)),
        'loadingHelp': loadingHelp.wire,
        'pickupAccess': pickupAccess.toJson(),
        'dropoffAccess': dropoffAccess.toJson(),
        'paymentMethodId': ?paymentMethodId,
      },
    ),
    Order.fromJson,
  );

  /// 요금에 붙는 것들의 규칙: 운반 도움·계단·추가 요금 단가, 대기료, 취소 수수료, 노쇼.
  Future<ChargeRules> chargeRules() async => parseResponse(
    await _transport.send('GET', '/orders/charge-policy'),
    ChargeRules.fromJson,
  );

  /// 다른 카드로 다시 요청. 배차 때 결제가 안 된([OrderStatus.paymentFailed]) 주문을
  /// 고른 카드로 바꿔 다시 배차 대기로 올린다.
  Future<Order> retryPayment(String orderId, String paymentMethodId) async =>
      parseResponse(
        await _transport.send(
          'POST',
          _path(orderId, '/retry-payment'),
          body: {'paymentMethodId': paymentMethodId},
        ),
        Order.fromJson,
      );

  /// 영수증. 결제한 적이 없으면 [ApiErrorCode.receiptNotFound].
  Future<Receipt> receipt(String orderId) async => parseResponse(
    await _transport.send('GET', _path(orderId, '/receipt')),
    Receipt.fromJson,
  );

  /// 내 주문 목록 (최근 요청순). 배차된 주문에는 기사 이름([Order.driverName])이 붙는다.
  Future<Paged<Order>> list({
    OrderStatus? status,
    ServiceType? serviceType,
    int page = 1,
    int size = 20,
  }) async => parseResponse(
    await _transport.send(
      'GET',
      '/orders',
      query: {
        'status': status?.wire,
        'serviceType': serviceType?.wire,
        'page': page,
        'size': size,
      },
    ),
    (json) => Paged.fromJson(json, Order.fromJson),
  );

  /// 최근 보낸 곳. 지난 주문의 도착지를 최근 순으로, 주소별로 한 번씩 준다.
  Future<List<RecentDestination>> recentDestinations({int limit = 5}) async =>
      parseListResponse(
        await _transport.send(
          'GET',
          '/orders/recent-destinations',
          query: {'limit': limit},
        ),
        RecentDestination.fromJson,
      );

  /// 주문 상세. 요청한 고객과 배차된 기사만 볼 수 있다 — 그 밖에는 [ApiErrorCode.orderNotFound].
  Future<OrderDetail> get(String orderId) async => parseResponse(
    await _transport.send('GET', _path(orderId)),
    OrderDetail.fromJson,
  );

  /// 배송 추적. 기사의 현재 위치와, 그 위치에서 다시 어림한 픽업·도착 예정 시각.
  /// 배송 중 화면에서 주기적으로 부른다.
  Future<Tracking> tracking(String orderId) async => parseResponse(
    await _transport.send('GET', _path(orderId, '/tracking')),
    Tracking.fromJson,
  );

  /// 주문 취소. 결제했으면 취소 수수료([Order.cancellationFeeNow])를 빼고 카드로 돌려준다.
  /// 기사가 픽업한 뒤에는 [ApiErrorCode.orderNotCancellable], 배차하며 결제하는 중이면
  /// [ApiErrorCode.paymentInProgress].
  Future<Order> cancel(String orderId, {String? reason}) async => parseResponse(
    await _transport.send(
      'POST',
      _path(orderId, '/cancel'),
      body: {'reason': ?reason},
    ),
    Order.fromJson,
  );

  /// 기사 평가. 배송이 완료된 주문에 한 번만 남길 수 있다.
  ///
  /// 배송이 끝나기 전이면 [ApiErrorCode.orderNotDelivered],
  /// 이미 평가했으면 [ApiErrorCode.reviewAlreadyWritten].
  Future<Review> review(
    String orderId, {
    required int rating,
    List<ReviewTag> tags = const [],
    String? comment,
  }) async => parseResponse(
    await _transport.send(
      'POST',
      _path(orderId, '/review'),
      body: {
        'rating': rating,
        if (tags.isNotEmpty) 'tags': [for (final tag in tags) tag.wire],
        'comment': ?comment,
      },
    ),
    Review.fromJson,
  );

  /// 주문 메시지 (보낸 순). 고객과 배차된 기사가 함께 쓴다.
  ///
  /// [after]를 주면 그 뒤에 온 메시지만 준다 — 대화 화면에서 새 메시지를 확인할 때
  /// 마지막으로 받은 메시지의 [OrderMessage.createdAt]을 넣는다.
  Future<List<OrderMessage>> messages(
    String orderId, {
    DateTime? after,
  }) async => parseListResponse(
    await _transport.send(
      'GET',
      _path(orderId, '/messages'),
      query: {'after': after == null ? null : toWireDate(after)},
    ),
    OrderMessage.fromJson,
  );

  /// 메시지 보내기 (500자까지). 받는 쪽에 푸시가 간다.
  ///
  /// 배차 전이거나 배송이 끝났으면 [ApiErrorCode.orderNotInProgress].
  Future<OrderMessage> sendMessage(String orderId, String text) async =>
      parseResponse(
        await _transport.send(
          'POST',
          _path(orderId, '/messages'),
          body: {'text': text},
        ),
        OrderMessage.fromJson,
      );
}
