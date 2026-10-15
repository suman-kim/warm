import '../json.dart';
import 'coordinates.dart';
import 'enums.dart';
import 'inputs.dart';
import 'payment.dart';

/// 층과 엘리베이터. 엘리베이터가 없으면 2층부터 계단 요금이 붙는다.
class FloorAccess {
  const FloorAccess({required this.floor, required this.elevator});

  factory FloorAccess.fromJson(Json json) => FloorAccess(
    floor: (json['floor'] as num).toInt(),
    elevator: json['elevator'] as bool,
  );

  static const ground = FloorAccess(floor: 1, elevator: true);

  final int floor;
  final bool elevator;

  /// 계단 요금이 붙는지 (엘리베이터 없는 2층 이상)
  bool get hasStairs => !elevator && floor > 1;

  Json toJson() => {'floor': floor, 'elevator': elevator};
}

/// 기사가 픽업할 때 넣는 추가 요금의 수량.
class ExtraItems {
  const ExtraItems({this.overload = 0, this.bulky = 0, this.stairs = 0});

  factory ExtraItems.fromJson(Json json) => ExtraItems(
    overload: (json['overload'] as num).toInt(),
    bulky: (json['bulky'] as num).toInt(),
    stairs: (json['stairs'] as num).toInt(),
  );

  static const none = ExtraItems();

  /// 과적 단계
  final int overload;

  /// 큰 짐 개수
  final int bulky;

  /// 엘리베이터 없이 오른 층
  final int stairs;

  bool get isEmpty => overload == 0 && bulky == 0 && stairs == 0;

  Json toJson() => {'overload': overload, 'bulky': bulky, 'stairs': stairs};
}

/// 픽업지·도착지.
class Waypoint {
  const Waypoint({
    required this.address,
    required this.detailAddress,
    required this.sigungu,
    required this.dong,
    required this.latitude,
    required this.longitude,
    required this.contactName,
    required this.contactPhone,
  });

  factory Waypoint.fromJson(Json json) => Waypoint(
    address: json['address'] as String,
    detailAddress: json['detailAddress'] as String?,
    sigungu: json['sigungu'] as String?,
    dong: json['dong'] as String?,
    latitude: (json['latitude'] as num).toDouble(),
    longitude: (json['longitude'] as num).toDouble(),
    contactName: json['contactName'] as String,
    contactPhone: json['contactPhone'] as String,
  );

  final String address;
  final String? detailAddress;

  /// 시·군·구 (예: 성동구)
  final String? sigungu;

  /// 읍·면·동 (예: 성수동2가)
  final String? dong;
  final double latitude;
  final double longitude;

  /// 현장에서 화물을 주고받을 사람
  final String contactName;
  final String contactPhone;

  Coordinates get coordinates =>
      Coordinates(latitude: latitude, longitude: longitude);
}

/// 화물.
class Cargo {
  const Cargo({
    required this.category,
    required this.weightKg,
    required this.quantity,
    required this.description,
  });

  factory Cargo.fromJson(Json json) => Cargo(
    category: CargoCategory.parse(json['category'] as String),
    weightKg: (json['weightKg'] as num).toDouble(),
    quantity: (json['quantity'] as num).toInt(),
    description: json['description'] as String?,
  );

  final CargoCategory category;

  /// 전체 중량(kg)
  final double weightKg;
  final int quantity;

  /// 종류만으로 부족할 때 덧붙인 설명
  final String? description;
}

/// 주문. 요청한 고객과 배차된 기사만 받는다 (연락처 포함).
class Order {
  const Order({
    required this.id,
    required this.code,
    required this.customerId,
    required this.status,
    required this.serviceType,
    required this.vehicleType,
    required this.pickup,
    required this.dropoff,
    required this.cargo,
    required this.memo,
    required this.distanceKm,
    required this.durationMinutes,
    required this.baseFare,
    required this.loadingHelp,
    required this.helpFee,
    required this.pickupAccess,
    required this.dropoffAccess,
    required this.stairFee,
    required this.fare,
    required this.extraItems,
    required this.extraFee,
    required this.waitingMinutes,
    required this.waitingFee,
    required this.totalFare,
    required this.cancellationFee,
    required this.cancellationFeeNow,
    required this.noShowAvailableAt,
    required this.paymentFailure,
    required this.earning,
    required this.driverId,
    required this.driverName,
    required this.payment,
    required this.scheduledPickupAt,
    required this.estimatedPickupAt,
    required this.estimatedDeliveryAt,
    required this.requestedAt,
    required this.assignedAt,
    required this.departedAt,
    required this.arrivedAt,
    required this.pickedUpAt,
    required this.deliveredAt,
    required this.cancelledAt,
    required this.noShowAt,
    required this.cancelReason,
  });

  factory Order.fromJson(Json json) => Order(
    id: json['id'] as String,
    code: json['code'] as String,
    customerId: json['customerId'] as String,
    status: OrderStatus.parse(json['status'] as String),
    serviceType: ServiceType.parse(json['serviceType'] as String),
    vehicleType: VehicleType.parse(json['vehicleType'] as String),
    pickup: Waypoint.fromJson(json['pickup'] as Json),
    dropoff: Waypoint.fromJson(json['dropoff'] as Json),
    cargo: Cargo.fromJson(json['cargo'] as Json),
    memo: json['memo'] as String?,
    distanceKm: (json['distanceKm'] as num).toDouble(),
    durationMinutes: (json['durationMinutes'] as num).toInt(),
    baseFare: (json['baseFare'] as num).toInt(),
    loadingHelp: LoadingHelp.parse(json['loadingHelp'] as String),
    helpFee: (json['helpFee'] as num).toInt(),
    pickupAccess: FloorAccess.fromJson(json['pickupAccess'] as Json),
    dropoffAccess: FloorAccess.fromJson(json['dropoffAccess'] as Json),
    stairFee: (json['stairFee'] as num).toInt(),
    fare: (json['fare'] as num).toInt(),
    extraItems: ExtraItems.fromJson(json['extraItems'] as Json),
    extraFee: (json['extraFee'] as num).toInt(),
    waitingMinutes: (json['waitingMinutes'] as num).toInt(),
    waitingFee: (json['waitingFee'] as num).toInt(),
    totalFare: (json['totalFare'] as num).toInt(),
    cancellationFee: (json['cancellationFee'] as num).toInt(),
    cancellationFeeNow: (json['cancellationFeeNow'] as num?)?.toInt(),
    noShowAvailableAt: parseDateOrNull(json['noShowAvailableAt']),
    paymentFailure: json['paymentFailure'] == null
        ? null
        : PaymentFailure.fromJson(json['paymentFailure'] as Json),
    earning: (json['earning'] as num?)?.toInt(),
    driverId: json['driverId'] as String?,
    driverName: json['driverName'] as String?,
    payment: json['payment'] == null
        ? null
        : OrderPayment.fromJson(json['payment'] as Json),
    scheduledPickupAt: parseDateOrNull(json['scheduledPickupAt']),
    estimatedPickupAt: parseDateOrNull(json['estimatedPickupAt']),
    estimatedDeliveryAt: parseDateOrNull(json['estimatedDeliveryAt']),
    requestedAt: parseDate(json['requestedAt']),
    assignedAt: parseDateOrNull(json['assignedAt']),
    departedAt: parseDateOrNull(json['departedAt']),
    arrivedAt: parseDateOrNull(json['arrivedAt']),
    pickedUpAt: parseDateOrNull(json['pickedUpAt']),
    deliveredAt: parseDateOrNull(json['deliveredAt']),
    cancelledAt: parseDateOrNull(json['cancelledAt']),
    noShowAt: parseDateOrNull(json['noShowAt']),
    cancelReason: json['cancelReason'] as String?,
  );

  final String id;

  /// 주문번호 (예: MV261013-3F9A)
  final String code;
  final String customerId;
  final OrderStatus status;
  final ServiceType serviceType;
  final VehicleType vehicleType;
  final Waypoint pickup;
  final Waypoint dropoff;
  final Cargo cargo;

  /// 기사에게 전하는 요청 사항
  final String? memo;

  /// 운행 거리(km)
  final double distanceKm;

  /// 픽업지에서 도착지까지 예상 소요 시간(분)
  final int durationMinutes;

  /// 기본 요금(원) — 차종과 거리로 정한다
  final int baseFare;

  /// 고객이 고른 큰 짐 운반 도움과 그 요금
  final LoadingHelp loadingHelp;
  final int helpFee;
  final FloorAccess pickupAccess;
  final FloorAccess dropoffAccess;

  /// 엘리베이터 없는 층의 계단 요금
  final int stairFee;

  /// 배차될 때 결제하는 요금(원) = 기본 요금 + 운반 도움 + 계단
  final int fare;

  /// 기사가 픽업할 때 넣은 추가 요금
  final ExtraItems extraItems;
  final int extraFee;

  /// 기사가 도착한 뒤 픽업까지 기다린 시간(분)과 대기료
  final int waitingMinutes;
  final int waitingFee;

  /// 최종 요금 = 배차 때 결제한 요금 + 추가 요금 + 대기료
  final int totalFare;

  /// 취소 수수료 또는 노쇼 요금. 없으면 0.
  final int cancellationFee;

  /// 지금 취소하면 붙는 수수료. 취소할 수 없는 상태면 null.
  final int? cancellationFeeNow;

  /// 노쇼를 신고할 수 있게 되는 시각. 기사가 도착한 주문만.
  final DateTime? noShowAvailableAt;

  /// 배차 때 결제가 안 된 사유. [OrderStatus.paymentFailed]일 때만.
  final PaymentFailure? paymentFailure;

  /// 이 배송으로 기사가 받는 금액(원) — 최종 요금에서 수수료를 뺀 값, 취소·노쇼면 취소 보상.
  /// 기사가 보는 주문(배송 목록, 수락·진행의 응답)에만 온다. 고객의 주문에는 null.
  final int? earning;

  /// 결제 정보. 고객의 주문 목록(`orders.list`)에서만 온다 — 상세는 [OrderDetail.payment].
  final OrderPayment? payment;

  /// 배차된 기사 ID. 배차 전에는 null.
  final String? driverId;

  /// 배차된 기사 이름. 고객의 주문 목록(`orders.list`)에서만 온다 — 그 밖에는 null.
  final String? driverName;

  /// 예약 픽업 시각. null이면 바로 픽업.
  final DateTime? scheduledPickupAt;

  /// 픽업 예정 시각. 배차될 때 기사 위치로 어림한 값이다. 모르면 null.
  final DateTime? estimatedPickupAt;

  /// 도착 예정 시각. 어림할 수 없거나 이미 끝난 주문이면 null.
  /// 배송 중 화면에서는 `orders.tracking`이 주는 값이 더 새롭다.
  final DateTime? estimatedDeliveryAt;
  final DateTime requestedAt;
  final DateTime? assignedAt;

  /// 기사가 픽업지로 출발한 시각
  final DateTime? departedAt;

  /// 기사가 픽업지에 도착한 시각
  final DateTime? arrivedAt;
  final DateTime? pickedUpAt;
  final DateTime? deliveredAt;
  final DateTime? cancelledAt;

  /// 노쇼로 처리된 시각
  final DateTime? noShowAt;
  final String? cancelReason;

  /// 고객이 아직 취소할 수 있는지 (기사가 픽업하기 전까지, 결제 중은 빼고).
  bool get isCancellable => cancellationFeeNow != null;

  /// 기사가 배정돼 배송이 진행 중인지 (배차 완료 ~ 배송 완료 전).
  /// 이 동안에만 추적·메시지·길안내를 쓸 수 있다.
  bool get isInProgress => const [
    OrderStatus.assigned,
    OrderStatus.departed,
    OrderStatus.arrived,
    OrderStatus.pickedUp,
  ].contains(status);

  /// 기사가 픽업하러 가는 중인지 (배차 완료 ~ 픽업 전).
  bool get isAwaitingPickup => const [
    OrderStatus.assigned,
    OrderStatus.departed,
    OrderStatus.arrived,
  ].contains(status);

  /// 추가 요금과 대기료의 합
  int get additionalFare => extraFee + waitingFee;
}

/// 배차된 기사. 고객이 주문 상세에서 본다.
class AssignedDriver {
  const AssignedDriver({
    required this.id,
    required this.name,
    required this.phone,
    required this.vehicleType,
    required this.vehicleNumber,
    required this.rating,
    required this.reviewCount,
  });

  factory AssignedDriver.fromJson(Json json) => AssignedDriver(
    id: json['id'] as String,
    name: json['name'] as String,
    phone: json['phone'] as String,
    vehicleType: VehicleType.parse(json['vehicleType'] as String),
    vehicleNumber: json['vehicleNumber'] as String,
    rating: (json['rating'] as num?)?.toDouble(),
    reviewCount: (json['reviewCount'] as num).toInt(),
  );

  final String id;
  final String name;
  final String phone;
  final VehicleType vehicleType;
  final String vehicleNumber;

  /// 평균 별점 (1~5, 소수 첫째 자리). 받은 평가가 없으면 null.
  final double? rating;
  final int reviewCount;
}

/// 고객이 기사에게 남긴 평가.
class Review {
  const Review({
    required this.rating,
    required this.tags,
    required this.comment,
    required this.createdAt,
  });

  factory Review.fromJson(Json json) => Review(
    rating: (json['rating'] as num).toInt(),
    tags: [
      for (final tag in json['tags'] as List<dynamic>)
        ReviewTag.parse(tag as String),
    ],
    comment: json['comment'] as String?,
    createdAt: parseDate(json['createdAt']),
  );

  /// 별점 1~5
  final int rating;
  final List<ReviewTag> tags;
  final String? comment;
  final DateTime createdAt;
}

/// 주문 상세. 주문에 배차된 기사와 평가가 붙는다.
class OrderDetail {
  const OrderDetail({
    required this.order,
    required this.driver,
    required this.review,
    required this.payment,
  });

  factory OrderDetail.fromJson(Json json) => OrderDetail(
    order: Order.fromJson(json),
    payment: json['payment'] == null
        ? null
        : OrderPayment.fromJson(json['payment'] as Json),
    driver: json['driver'] == null
        ? null
        : AssignedDriver.fromJson(json['driver'] as Json),
    review: json['review'] == null
        ? null
        : Review.fromJson(json['review'] as Json),
  );

  final Order order;

  /// 배차된 기사. 배차 전에는 null.
  final AssignedDriver? driver;

  /// 이 주문에 남긴 평가. 아직 없으면 null.
  final Review? review;

  /// 결제 정보. 고객만 받는다 — 기사가 보면 null.
  final OrderPayment? payment;

  /// 지금 평가를 남길 수 있는지 (배송이 끝났고 아직 평가하지 않았다).
  bool get canReview => order.status == OrderStatus.delivered && review == null;
}

/// 배차 대기 주문(콜). 아직 수락하지 않은 기사에게 보이므로 위치는 동 단위까지만 있고,
/// 주소·연락처·요청 사항은 없다. 수락하면 [Order]로 전부 받는다.
class OpenOrder {
  const OpenOrder({
    required this.id,
    required this.serviceType,
    required this.vehicleType,
    required this.pickupArea,
    required this.pickup,
    required this.dropoffArea,
    required this.dropoff,
    required this.cargo,
    required this.distanceKm,
    required this.durationMinutes,
    required this.baseFare,
    required this.loadingHelp,
    required this.helpFee,
    required this.pickupAccess,
    required this.dropoffAccess,
    required this.stairFee,
    required this.fare,
    required this.scheduledPickupAt,
    required this.requestedAt,
    required this.distanceFromMeKm,
  });

  factory OpenOrder.fromJson(Json json) => OpenOrder(
    id: json['id'] as String,
    serviceType: ServiceType.parse(json['serviceType'] as String),
    vehicleType: VehicleType.parse(json['vehicleType'] as String),
    pickupArea: json['pickupArea'] as String,
    pickup: Coordinates(
      latitude: (json['pickupLatitude'] as num).toDouble(),
      longitude: (json['pickupLongitude'] as num).toDouble(),
    ),
    dropoffArea: json['dropoffArea'] as String,
    dropoff: Coordinates(
      latitude: (json['dropoffLatitude'] as num).toDouble(),
      longitude: (json['dropoffLongitude'] as num).toDouble(),
    ),
    cargo: Cargo.fromJson(json['cargo'] as Json),
    distanceKm: (json['distanceKm'] as num).toDouble(),
    durationMinutes: (json['durationMinutes'] as num).toInt(),
    baseFare: (json['baseFare'] as num).toInt(),
    loadingHelp: LoadingHelp.parse(json['loadingHelp'] as String),
    helpFee: (json['helpFee'] as num).toInt(),
    pickupAccess: FloorAccess.fromJson(json['pickupAccess'] as Json),
    dropoffAccess: FloorAccess.fromJson(json['dropoffAccess'] as Json),
    stairFee: (json['stairFee'] as num).toInt(),
    fare: (json['fare'] as num).toInt(),
    scheduledPickupAt: parseDateOrNull(json['scheduledPickupAt']),
    requestedAt: parseDate(json['requestedAt']),
    distanceFromMeKm: (json['distanceFromMeKm'] as num?)?.toDouble(),
  );

  final String id;
  final ServiceType serviceType;
  final VehicleType vehicleType;

  /// 픽업지 (예: 성동구 성수동2가)
  final String pickupArea;

  /// 픽업지의 대략적인 위치 (약 1km 단위로 흐려져 있다). 지도에 표시하는 데만 쓴다.
  final Coordinates pickup;

  /// 도착지 (예: 강남구 역삼동)
  final String dropoffArea;

  /// 도착지의 대략적인 위치
  final Coordinates dropoff;
  final Cargo cargo;

  /// 픽업지에서 도착지까지의 운행 거리(km)
  final double distanceKm;
  final int durationMinutes;

  /// 기본 요금 — 차종과 거리
  final int baseFare;

  /// 고객이 고른 운반 도움과 그 요금
  final LoadingHelp loadingHelp;
  final int helpFee;
  final FloorAccess pickupAccess;
  final FloorAccess dropoffAccess;
  final int stairFee;

  /// 배차될 때 결제하는 요금 = 기본 요금 + 운반 도움 + 계단
  final int fare;
  final DateTime? scheduledPickupAt;
  final DateTime requestedAt;

  /// 내 위치에서 픽업지까지의 직선 거리(km). `drivers.reportLocation`으로 위치를
  /// 보낸 적이 없으면 null.
  final double? distanceFromMeKm;
}

/// 차종 하나의 견적.
class FareOption {
  const FareOption({
    required this.vehicleType,
    required this.label,
    required this.serviceType,
    required this.capacityHint,
    required this.maxLoadKg,
    required this.fare,
  });

  factory FareOption.fromJson(Json json) => FareOption(
    vehicleType: VehicleType.parse(json['vehicleType'] as String),
    label: json['label'] as String,
    serviceType: ServiceType.parse(json['serviceType'] as String),
    capacityHint: json['capacityHint'] as String,
    maxLoadKg: (json['maxLoadKg'] as num).toDouble(),
    fare: (json['fare'] as num).toInt(),
  );

  /// 이 버전의 앱이 모르는 차종이면 [VehicleType.unknown] — 선택지에서 뺀다.
  final VehicleType vehicleType;

  /// 화면에 보여줄 이름 (예: 다마스)
  final String label;
  final ServiceType serviceType;

  /// 무엇을 싣기 좋은지 한 줄로 (예: 박스 10개)
  final String capacityHint;
  final double maxLoadKg;

  /// 예상 요금(원). 이 차종으로 요청하면 이 요금으로 주문된다.
  final int fare;
}

/// 요금 견적. 한 번에 차종별 요금을 모두 준다.
class FareEstimates {
  const FareEstimates({
    required this.distanceKm,
    required this.durationMinutes,
    required this.route,
    required this.options,
  });

  factory FareEstimates.fromJson(Json json) => FareEstimates(
    distanceKm: (json['distanceKm'] as num).toDouble(),
    durationMinutes: (json['durationMinutes'] as num).toInt(),
    route: _route(json['route']),
    options: [
      for (final option in json['options'] as List<dynamic>)
        FareOption.fromJson(option as Json),
    ],
  );

  /// 운행 거리(km)
  final double distanceKm;

  /// 예상 소요 시간(분)
  final int durationMinutes;

  /// 지도에 그릴 경로 (출발 → 도착 순)
  final List<Coordinates> route;
  final List<FareOption> options;
}

/// 차종 안내.
class VehicleTypeInfo {
  const VehicleTypeInfo({
    required this.type,
    required this.label,
    required this.serviceType,
    required this.capacityHint,
    required this.maxLoadKg,
  });

  factory VehicleTypeInfo.fromJson(Json json) => VehicleTypeInfo(
    type: VehicleType.parse(json['type'] as String),
    label: json['label'] as String,
    serviceType: ServiceType.parse(json['serviceType'] as String),
    capacityHint: json['capacityHint'] as String,
    maxLoadKg: (json['maxLoadKg'] as num).toDouble(),
  );

  /// 이 버전의 앱이 모르는 차종이면 [VehicleType.unknown] — 선택지에서 뺀다.
  final VehicleType type;

  /// 화면에 보여줄 이름 (예: 다마스)
  final String label;
  final ServiceType serviceType;

  /// 무엇을 싣기 좋은지 한 줄로 (예: 박스 10개)
  final String capacityHint;

  /// 최대 적재 중량(kg). 이보다 무거운 화물은 이 차종으로 요청할 수 없다.
  final double maxLoadKg;
}

/// 기사의 현재 위치.
class DriverLocation {
  const DriverLocation({required this.coordinates, required this.updatedAt});

  factory DriverLocation.fromJson(Json json) => DriverLocation(
    coordinates: Coordinates.fromJson(json),
    updatedAt: parseDate(json['updatedAt']),
  );

  final Coordinates coordinates;

  /// 기사 앱이 이 위치를 보낸 시각. 오래됐으면 화면에 그렇게 보여준다.
  final DateTime updatedAt;
}

/// 배송 추적. 고객이 진행 중인 주문의 기사 위치와 도착 예정을 본다.
class Tracking {
  const Tracking({
    required this.status,
    required this.driverLocation,
    required this.estimatedPickupAt,
    required this.estimatedDeliveryAt,
  });

  factory Tracking.fromJson(Json json) => Tracking(
    status: OrderStatus.parse(json['status'] as String),
    driverLocation: json['driverLocation'] == null
        ? null
        : DriverLocation.fromJson(json['driverLocation'] as Json),
    estimatedPickupAt: parseDateOrNull(json['estimatedPickupAt']),
    estimatedDeliveryAt: parseDateOrNull(json['estimatedDeliveryAt']),
  );

  final OrderStatus status;

  /// 기사 위치. 진행 중이 아니거나 기사가 위치를 보낸 적이 없으면 null.
  final DriverLocation? driverLocation;
  final DateTime? estimatedPickupAt;
  final DateTime? estimatedDeliveryAt;
}

/// 길안내. 기사가 다음에 갈 곳까지의 경로다.
class NavigationRoute {
  const NavigationRoute({
    required this.target,
    required this.address,
    required this.destination,
    required this.distanceKm,
    required this.durationMinutes,
    required this.route,
  });

  factory NavigationRoute.fromJson(Json json) => NavigationRoute(
    target: NavigationTarget.parse(json['target'] as String),
    address: json['address'] as String,
    destination: Coordinates.fromJson(json),
    distanceKm: (json['distanceKm'] as num).toDouble(),
    durationMinutes: (json['durationMinutes'] as num).toInt(),
    route: _route(json['route']),
  );

  /// 지금 향하는 곳: 픽업 전이면 픽업지, 픽업한 뒤면 도착지
  final NavigationTarget target;
  final String address;
  final Coordinates destination;
  final double distanceKm;
  final int durationMinutes;

  /// 지도에 그릴 경로 (내 위치 → 목적지 순)
  final List<Coordinates> route;
}

/// 주문 메시지.
class OrderMessage {
  const OrderMessage({
    required this.id,
    required this.mine,
    required this.text,
    required this.createdAt,
  });

  factory OrderMessage.fromJson(Json json) => OrderMessage(
    id: json['id'] as String,
    mine: json['mine'] as bool,
    text: json['text'] as String,
    createdAt: parseDate(json['createdAt']),
  );

  final String id;

  /// 내가 보낸 메시지인지
  final bool mine;
  final String text;
  final DateTime createdAt;
}

/// 최근 보낸 곳. 지난 주문의 도착지다.
class RecentDestination {
  const RecentDestination({required this.waypoint, required this.lastUsedAt});

  factory RecentDestination.fromJson(Json json) => RecentDestination(
    waypoint: Waypoint.fromJson(json),
    lastUsedAt: parseDate(json['lastUsedAt']),
  );

  final Waypoint waypoint;
  final DateTime lastUsedAt;

  /// 이 곳으로 다시 보낼 때 쓰는 도착지 입력.
  WaypointInput toInput() => WaypointInput(
    address: waypoint.address,
    detailAddress: waypoint.detailAddress,
    sigungu: waypoint.sigungu,
    dong: waypoint.dong,
    latitude: waypoint.latitude,
    longitude: waypoint.longitude,
    contactName: waypoint.contactName,
    contactPhone: waypoint.contactPhone,
  );
}

List<Coordinates> _route(Object? json) => [
  for (final point in json as List<dynamic>)
    Coordinates.fromJson(point as Json),
];
