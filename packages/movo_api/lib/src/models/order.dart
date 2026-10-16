import '../json.dart';
import 'coordinates.dart';
import 'enums.dart';

/// 가게(픽업지)·손님(도착지).
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

  /// 가게 이름, 또는 손님이면 '손님'
  final String contactName;

  /// 가게 전화, 또는 손님의 연락처(배달앱 안심번호)
  final String contactPhone;

  Coordinates get coordinates =>
      Coordinates(latitude: latitude, longitude: longitude);
}

/// 배달. 요청한 사장님과 배차된 라이더만 받는다 (연락처 포함).
class Order {
  const Order({
    required this.id,
    required this.code,
    required this.customerId,
    required this.status,
    required this.storeDelivery,
    required this.pickup,
    required this.dropoff,
    required this.memo,
    required this.distanceKm,
    required this.durationMinutes,
    required this.fare,
    required this.cancellationFee,
    required this.cancellationFeeNow,
    required this.earning,
    required this.driverId,
    required this.driverName,
    required this.estimatedPickupAt,
    required this.estimatedDeliveryAt,
    required this.requestedAt,
    required this.assignedAt,
    required this.departedAt,
    required this.arrivedAt,
    required this.pickedUpAt,
    required this.deliveredAt,
    required this.cancelledAt,
    required this.cancelReason,
  });

  factory Order.fromJson(Json json) => Order(
    id: json['id'] as String,
    code: json['code'] as String,
    customerId: json['customerId'] as String,
    status: OrderStatus.parse(json['status'] as String),
    storeDelivery: StoreDelivery.fromJson(json['storeDelivery'] as Json),
    pickup: Waypoint.fromJson(json['pickup'] as Json),
    dropoff: Waypoint.fromJson(json['dropoff'] as Json),
    memo: json['memo'] as String?,
    distanceKm: (json['distanceKm'] as num).toDouble(),
    durationMinutes: (json['durationMinutes'] as num).toInt(),
    fare: (json['fare'] as num).toInt(),
    cancellationFee: (json['cancellationFee'] as num).toInt(),
    cancellationFeeNow: (json['cancellationFeeNow'] as num?)?.toInt(),
    earning: (json['earning'] as num?)?.toInt(),
    driverId: json['driverId'] as String?,
    driverName: json['driverName'] as String?,
    estimatedPickupAt: parseDateOrNull(json['estimatedPickupAt']),
    estimatedDeliveryAt: parseDateOrNull(json['estimatedDeliveryAt']),
    requestedAt: parseDate(json['requestedAt']),
    assignedAt: parseDateOrNull(json['assignedAt']),
    departedAt: parseDateOrNull(json['departedAt']),
    arrivedAt: parseDateOrNull(json['arrivedAt']),
    pickedUpAt: parseDateOrNull(json['pickedUpAt']),
    deliveredAt: parseDateOrNull(json['deliveredAt']),
    cancelledAt: parseDateOrNull(json['cancelledAt']),
    cancelReason: json['cancelReason'] as String?,
  );

  final String id;

  /// 주문번호 (예: MV261015-3F9A) — 라이더는 끝 네 자리를 가게에 말한다
  final String code;

  /// 요청한 사장님 (users.id)
  final String customerId;
  final OrderStatus status;

  /// 어느 가게의 배달인지, 음식값과 받는 방식, 조리 완료 시각, 받은 돈
  final StoreDelivery storeDelivery;

  /// 가게
  final Waypoint pickup;

  /// 손님
  final Waypoint dropoff;

  /// 라이더에게 남긴 요청 사항
  final String? memo;

  /// 가게에서 손님까지의 운행 거리(km)
  final double distanceKm;

  /// 가게에서 손님까지 예상 소요 시간(분)
  final int durationMinutes;

  /// 배달대행료(원) — 요청할 때 충전금에서 빠졌다
  final int fare;

  /// 취소했으면 낸 수수료. 없으면 0.
  final int cancellationFee;

  /// 지금 취소하면 내는 수수료. 취소할 수 없으면(픽업 뒤) null.
  final int? cancellationFeeNow;

  /// 이 배달로 라이더가 받는 금액(원) — 대행료에서 수수료를 뺀 값, 취소면 취소 보상.
  /// 라이더가 보는 배달(배달 목록, 수락·진행의 응답)에만 온다. 가게의 배달에는 null.
  final int? earning;

  /// 배차된 라이더 ID. 배차 전에는 null.
  final String? driverId;

  /// 배차된 라이더 이름. 가게의 배달 목록(`orders.list`)에서만 온다 — 그 밖에는 null.
  final String? driverName;

  /// 픽업 예정 시각. 배차될 때 라이더 위치와 조리 완료 시각으로 어림한 값이다. 모르면 null.
  final DateTime? estimatedPickupAt;

  /// 도착 예정 시각. 어림할 수 없거나 이미 끝난 배달이면 null.
  /// 배달 중 화면에서는 `orders.tracking`이 주는 값이 더 새롭다.
  final DateTime? estimatedDeliveryAt;
  final DateTime requestedAt;
  final DateTime? assignedAt;

  /// 라이더가 가게로 출발한 시각
  final DateTime? departedAt;

  /// 라이더가 가게에 도착한 시각
  final DateTime? arrivedAt;
  final DateTime? pickedUpAt;
  final DateTime? deliveredAt;
  final DateTime? cancelledAt;
  final String? cancelReason;

  /// 가게가 아직 취소할 수 있는지 (라이더가 픽업하기 전까지).
  bool get isCancellable => cancellationFeeNow != null;

  /// 라이더가 배정돼 배달이 진행 중인지 (배차 완료 ~ 배달 완료 전).
  /// 이 동안에만 추적을 쓸 수 있다.
  bool get isInProgress => const [
    OrderStatus.assigned,
    OrderStatus.departed,
    OrderStatus.arrived,
    OrderStatus.pickedUp,
  ].contains(status);

  /// 라이더가 픽업하러 가는 중인지 (배차 완료 ~ 픽업 전).
  bool get isAwaitingPickup => const [
    OrderStatus.assigned,
    OrderStatus.departed,
    OrderStatus.arrived,
  ].contains(status);
}

/// 배차된 라이더. 가게가 배달 상세에서 본다.
class AssignedDriver {
  const AssignedDriver({
    required this.id,
    required this.name,
    required this.phone,
    required this.vehicleType,
    required this.vehicleNumber,
  });

  factory AssignedDriver.fromJson(Json json) => AssignedDriver(
    id: json['id'] as String,
    name: json['name'] as String,
    phone: json['phone'] as String,
    vehicleType: VehicleType.parse(json['vehicleType'] as String),
    vehicleNumber: json['vehicleNumber'] as String,
  );

  final String id;
  final String name;
  final String phone;
  final VehicleType vehicleType;

  /// 오토바이 번호판
  final String vehicleNumber;
}

/// 배달 상세. 배달에 배차된 라이더가 붙는다.
class OrderDetail {
  const OrderDetail({required this.order, required this.driver});

  factory OrderDetail.fromJson(Json json) => OrderDetail(
    order: Order.fromJson(json),
    driver: json['driver'] == null
        ? null
        : AssignedDriver.fromJson(json['driver'] as Json),
  );

  final Order order;

  /// 배차된 라이더. 배차 전에는 null.
  final AssignedDriver? driver;
}

/// 배차 대기 배달(콜). 아직 수락하지 않은 라이더에게 보이므로 위치는 동 단위까지만 있고,
/// 손님의 주소·연락처·요청 사항은 없다. 수락하면 [Order]로 전부 받는다.
class OpenOrder {
  const OpenOrder({
    required this.id,
    required this.storeDelivery,
    required this.pickupArea,
    required this.pickup,
    required this.dropoffArea,
    required this.dropoff,
    required this.distanceKm,
    required this.durationMinutes,
    required this.fare,
    required this.earning,
    required this.requestedAt,
    required this.distanceFromMeKm,
  });

  factory OpenOrder.fromJson(Json json) => OpenOrder(
    id: json['id'] as String,
    storeDelivery: OpenStoreDelivery.fromJson(json['storeDelivery'] as Json),
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
    distanceKm: (json['distanceKm'] as num).toDouble(),
    durationMinutes: (json['durationMinutes'] as num).toInt(),
    fare: (json['fare'] as num).toInt(),
    earning: (json['earning'] as num).toInt(),
    requestedAt: parseDate(json['requestedAt']),
    distanceFromMeKm: (json['distanceFromMeKm'] as num?)?.toDouble(),
  );

  final String id;

  /// 가게 이름·음식값·받는 방식·조리 완료 시각
  final OpenStoreDelivery storeDelivery;

  /// 가게 (예: 강남구 역삼동)
  final String pickupArea;

  /// 가게의 대략적인 위치 (약 1km 단위로 흐려져 있다). 지도에 표시하는 데만 쓴다.
  final Coordinates pickup;

  /// 손님 (예: 강남구 대치동)
  final String dropoffArea;

  /// 손님의 대략적인 위치
  final Coordinates dropoff;

  /// 가게에서 손님까지의 운행 거리(km)
  final double distanceKm;
  final int durationMinutes;

  /// 배달대행료
  final int fare;

  /// 수락하면 라이더가 받는 금액 — 대행료에서 수수료를 뺀 값
  final int earning;
  final DateTime requestedAt;

  /// 내 위치에서 가게까지의 직선 거리(km). `drivers.reportLocation`으로 위치를
  /// 보낸 적이 없으면 null.
  final double? distanceFromMeKm;
}

/// 라이더의 현재 위치.
class DriverLocation {
  const DriverLocation({required this.coordinates, required this.updatedAt});

  factory DriverLocation.fromJson(Json json) => DriverLocation(
    coordinates: Coordinates.fromJson(json),
    updatedAt: parseDate(json['updatedAt']),
  );

  final Coordinates coordinates;

  /// 라이더 앱이 이 위치를 보낸 시각. 오래됐으면 화면에 그렇게 보여준다.
  final DateTime updatedAt;
}

/// 배달 추적. 가게가 진행 중인 배달의 라이더 위치와 도착 예정을 본다.
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

  /// 라이더 위치. 진행 중이 아니거나 라이더가 위치를 보낸 적이 없으면 null.
  final DriverLocation? driverLocation;
  final DateTime? estimatedPickupAt;
  final DateTime? estimatedDeliveryAt;
}

/// 최근 배달한 곳. 지난 배달의 손님 주소다.
class RecentDestination {
  const RecentDestination({required this.waypoint, required this.lastUsedAt});

  factory RecentDestination.fromJson(Json json) => RecentDestination(
    waypoint: Waypoint.fromJson(json),
    lastUsedAt: parseDate(json['lastUsedAt']),
  );

  final Waypoint waypoint;
  final DateTime lastUsedAt;
}

/// 가게 배달 정보.
class StoreDelivery {
  const StoreDelivery({
    required this.storeId,
    required this.foodAmount,
    required this.doorPayment,
    required this.readyAt,
    required this.collectedMethod,
    required this.collectedAmount,
    required this.cashHandedAt,
  });

  factory StoreDelivery.fromJson(Json json) => StoreDelivery(
    storeId: json['storeId'] as String,
    foodAmount: (json['foodAmount'] as num).toInt(),
    doorPayment: DoorPayment.parse(json['doorPayment'] as String),
    readyAt: parseDateOrNull(json['readyAt']),
    collectedMethod: json['collectedMethod'] == null
        ? null
        : DoorPayment.parse(json['collectedMethod'] as String),
    collectedAmount: (json['collectedAmount'] as num?)?.toInt(),
    cashHandedAt: parseDateOrNull(json['cashHandedAt']),
  );

  final String storeId;

  /// 손님이 낼 음식값 (원)
  final int foodAmount;
  final DoorPayment doorPayment;

  /// 조리가 끝나 픽업할 수 있는 시각. 바로면 null.
  final DateTime? readyAt;

  /// 라이더가 손님에게 실제로 받은 방식과 금액 (배달 완료 뒤)
  final DoorPayment? collectedMethod;
  final int? collectedAmount;

  /// 라이더가 받은 현금을 가게에 넘긴 시각 (운영자가 확인). 아직이면 null.
  final DateTime? cashHandedAt;
}

/// 배차 대기 콜의 가게 배달 정보 — 라이더가 받을 돈을 미리 안다.
class OpenStoreDelivery {
  const OpenStoreDelivery({
    required this.storeName,
    required this.foodAmount,
    required this.doorPayment,
    required this.readyAt,
  });

  factory OpenStoreDelivery.fromJson(Json json) => OpenStoreDelivery(
    storeName: json['storeName'] as String,
    foodAmount: (json['foodAmount'] as num).toInt(),
    doorPayment: DoorPayment.parse(json['doorPayment'] as String),
    readyAt: parseDateOrNull(json['readyAt']),
  );

  final String storeName;
  final int foodAmount;
  final DoorPayment doorPayment;
  final DateTime? readyAt;
}
