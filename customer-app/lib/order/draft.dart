import 'package:movo_api/movo_api.dart';

import '../places.dart';

/// 작성 중인 배송 요청. 홈에서 시작해 배송 정보, 차종 선택을 거치며 채워진다.
class OrderDraft {
  OrderDraft({
    required this.service,
    required this.pickup,
    required this.dropoff,
    required this.senderName,
    required this.senderPhone,
  });

  ServiceType service;
  Place pickup;
  Place dropoff;

  CargoCategory category = CargoCategory.box;
  int quantity = 1;
  double weightKg = 5;

  /// 픽업지에서 물품을 건네줄 사람
  String senderName;
  String senderPhone;

  /// 도착지에서 물품을 받을 사람. 배차된 기사에게만 보인다.
  String receiverName = '';
  String receiverPhone = '';

  /// 예약 픽업 시각. null이면 지금 바로.
  DateTime? scheduledAt;
  String memo = '';

  /// 큰 짐 운반 도움과 출발지·도착지의 층과 엘리베이터. 요청할 때 요금에 더해진다.
  LoadingHelp loadingHelp = LoadingHelp.none;
  FloorAccess pickupAccess = FloorAccess.ground;
  FloorAccess dropoffAccess = FloorAccess.ground;

  /// 결제할 카드. null이면 기본 카드.
  String? paymentMethodId;

  /// 견적에서 먼저 골라 둘 차종 (지난 배송을 다시 보낼 때). 실을 수 없거나 없으면 가장 싼 차종.
  VehicleType? vehicleType;

  /// 고른 운반 도움과 계단의 요금.
  int addOnFare(ChargeRules rules) =>
      rules.helpFeeOf(loadingHelp) +
      rules.stairFeeOf(pickupAccess.floor, elevator: pickupAccess.elevator) +
      rules.stairFeeOf(dropoffAccess.floor, elevator: dropoffAccess.elevator);

  bool get hasReceiver =>
      receiverName.trim().isNotEmpty && receiverPhone.trim().isNotEmpty;

  WaypointInput get pickupInput => _input(pickup, senderName, senderPhone);
  WaypointInput get dropoffInput =>
      _input(dropoff, receiverName, receiverPhone);

  CargoInput get cargoInput =>
      CargoInput(category: category, weightKg: weightKg, quantity: quantity);

  static WaypointInput _input(Place place, String name, String phone) =>
      WaypointInput(
        address: place.address,
        detailAddress: place.detail,
        sigungu: place.sigungu,
        dong: place.dong,
        latitude: place.latitude,
        longitude: place.longitude,
        contactName: name.trim(),
        contactPhone: phone.trim(),
      );
}

/// 무게를 고를 때 보여주는 값(kg).
const weightChoices = <double>[
  1,
  3,
  5,
  10,
  15,
  20,
  30,
  50,
  100,
  200,
  400,
  500,
  1000,
  2500,
];
