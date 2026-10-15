// 서버가 문자열로 주고받는 값들.
//
// 각 enum의 `unknown`은 이 버전의 앱이 모르는 값이다. 서버에 값이 추가돼도(새 차종 등)
// 예전 버전의 앱이 응답을 읽다가 죽지 않게 한다. 요청에는 `unknown`을 보낼 수 없다.

/// 모르는 값이면 마지막 값(`unknown`)을 돌려준다 — 그래서 `unknown`은 항상 맨 끝에 둔다.
T _parse<T extends Enum>(
  List<T> values,
  String wire,
  String Function(T) wireOf,
) {
  for (final value in values) {
    if (wireOf(value) == wire) return value;
  }
  return values.last;
}

String _toWire(Enum value, String wire) {
  if (wire.isEmpty) {
    throw ArgumentError.value(value, null, '서버에 보낼 수 없는 값이에요');
  }
  return wire;
}

enum UserRole {
  /// 배송을 요청하는 고객
  customer('CUSTOMER'),

  /// 퀵·화물 기사
  driver('DRIVER'),

  /// 운영자
  admin('ADMIN'),
  unknown('');

  const UserRole(this._wire);
  final String _wire;

  String get wire => _toWire(this, _wire);
  static UserRole parse(String wire) => _parse(values, wire, (e) => e._wire);
}

/// 서비스 종류. 차종이 정해지면 서비스 종류도 정해진다.
enum ServiceType {
  /// 퀵배송
  quick('QUICK'),

  /// 화물
  freight('FREIGHT'),
  unknown('');

  const ServiceType(this._wire);
  final String _wire;

  String get wire => _toWire(this, _wire);
  static ServiceType parse(String wire) => _parse(values, wire, (e) => e._wire);
}

/// 차종. 화면에 보여줄 이름·적재 안내·최대 적재 중량은 `vehicleTypes.list()`로 받는다.
enum VehicleType {
  motorcycle('MOTORCYCLE'),
  damas('DAMAS'),
  labo('LABO'),
  truck1Ton('TRUCK_1T'),
  truck2HalfTon('TRUCK_2_5T'),
  truck5Ton('TRUCK_5T'),
  unknown('');

  const VehicleType(this._wire);
  final String _wire;

  String get wire => _toWire(this, _wire);
  static VehicleType parse(String wire) => _parse(values, wire, (e) => e._wire);
}

/// 주문 상태.
///
/// requested → assigned → pickedUp → delivered. 취소는 픽업 전까지만 된다.
enum OrderStatus {
  /// 배차 대기 — 기사가 수락할 수 있다. 아직 결제 전이다.
  requested('REQUESTED'),

  /// 기사가 수락해 고객의 카드로 결제하는 중 (잠깐)
  paying('PAYING'),

  /// 배차 때 결제가 안 돼 배차되지 않았다 — 고객이 다른 카드로 다시 요청할 수 있다
  paymentFailed('PAYMENT_FAILED'),

  /// 배차 완료 — 기사가 출발하기 전 (지금 취소하면 수수료가 없다)
  assigned('ASSIGNED'),

  /// 기사가 픽업지로 출발했다 (지금 취소하면 수수료 15%)
  departed('DEPARTED'),

  /// 기사가 픽업지에 도착해 기다리는 중 (대기 시간이 흐른다)
  arrived('ARRIVED'),

  /// 픽업 완료 — 배송 중
  pickedUp('PICKED_UP'),

  /// 배송 완료
  delivered('DELIVERED'),

  /// 취소됨
  cancelled('CANCELLED'),

  /// 기사가 도착하고 30분을 기다렸는데 고객이 나오지 않았다 (요금을 돌려주지 않는다)
  noShow('NO_SHOW'),
  unknown('');

  const OrderStatus(this._wire);
  final String _wire;

  String get wire => _toWire(this, _wire);
  static OrderStatus parse(String wire) => _parse(values, wire, (e) => e._wire);
}

/// 기사 심사 상태.
enum DriverStatus {
  /// 등록 신청 후 심사 대기
  pending('PENDING'),

  /// 승인됨 — 운행을 시작할 수 있다
  approved('APPROVED'),

  /// 반려됨 — 정보를 고쳐 다시 신청할 수 있다
  rejected('REJECTED'),
  unknown('');

  const DriverStatus(this._wire);
  final String _wire;

  String get wire => _toWire(this, _wire);
  static DriverStatus parse(String wire) =>
      _parse(values, wire, (e) => e._wire);
}

/// 물품 종류. 배송 요청 화면에서 하나를 고른다.
enum CargoCategory {
  /// 서류
  document('DOCUMENT'),

  /// 박스
  box('BOX'),

  /// 쇼핑백
  shoppingBag('SHOPPING_BAG'),

  /// 가구 · 가전
  furnitureAppliance('FURNITURE_APPLIANCE'),

  /// 기타
  etc('ETC'),
  unknown('');

  const CargoCategory(this._wire);
  final String _wire;

  String get wire => _toWire(this, _wire);
  static CargoCategory parse(String wire) =>
      _parse(values, wire, (e) => e._wire);
}

/// 기사를 평가할 때 고르는 칭찬 태그.
enum ReviewTag {
  /// 친절해요
  kind('KIND'),

  /// 빨라요
  fast('FAST'),

  /// 꼼꼼해요
  careful('CAREFUL'),
  unknown('');

  const ReviewTag(this._wire);
  final String _wire;

  String get wire => _toWire(this, _wire);
  static ReviewTag parse(String wire) => _parse(values, wire, (e) => e._wire);
}

/// 기사 등록에 내는 서류.
enum DriverDocumentType {
  /// 운전면허증
  driverLicense('DRIVER_LICENSE'),

  /// 자동차등록증
  vehicleRegistration('VEHICLE_REGISTRATION'),

  /// 화물운송 종사 자격증
  freightQualification('FREIGHT_QUALIFICATION'),
  unknown('');

  const DriverDocumentType(this._wire);
  final String _wire;

  String get wire => _toWire(this, _wire);
  static DriverDocumentType parse(String wire) =>
      _parse(values, wire, (e) => e._wire);
}

/// 서류 한 종류의 상태.
enum DriverDocumentStatus {
  /// 아직 올리지 않았다
  notSubmitted('NOT_SUBMITTED'),

  /// 올렸고 아직 심사 전
  submitted('SUBMITTED'),

  /// 확인됨
  approved('APPROVED'),

  /// 반려됨 — 다시 올려야 한다
  rejected('REJECTED'),
  unknown('');

  const DriverDocumentStatus(this._wire);
  final String _wire;

  static DriverDocumentStatus parse(String wire) =>
      _parse(values, wire, (e) => e._wire);
}

/// 길안내가 향하는 곳.
enum NavigationTarget {
  /// 픽업지 (픽업 전)
  pickup('PICKUP'),

  /// 도착지 (픽업한 뒤)
  dropoff('DROPOFF'),
  unknown('');

  const NavigationTarget(this._wire);
  final String _wire;

  static NavigationTarget parse(String wire) =>
      _parse(values, wire, (e) => e._wire);
}

/// 알림의 종류. 푸시의 `data.type`과 알림함의 `type`이 같은 값을 쓴다.
enum NotificationType {
  /// 새 주문 (기사) — 푸시로만 오고 알림함에는 쌓이지 않는다
  orderRequested('ORDER_REQUESTED'),

  /// 배차 완료 (고객)
  orderAssigned('ORDER_ASSIGNED'),

  /// 배차 때 결제가 안 돼 배차되지 않았다 (고객)
  orderPaymentFailed('ORDER_PAYMENT_FAILED'),

  /// 기사가 픽업지로 출발했다 (고객)
  orderDeparted('ORDER_DEPARTED'),

  /// 기사가 픽업지에 도착했다 (고객)
  orderArrived('ORDER_ARRIVED'),

  /// 픽업 완료 (고객)
  orderPickedUp('ORDER_PICKED_UP'),

  /// 배송 완료 (고객)
  orderDelivered('ORDER_DELIVERED'),

  /// 고객이 배차된 주문을 취소 (기사)
  orderCancelled('ORDER_CANCELLED'),

  /// 노쇼로 처리됐다 (고객)
  orderNoShow('ORDER_NO_SHOW'),

  /// 배차 때 결제했다 (고객)
  paymentPaid('PAYMENT_PAID'),

  /// 픽업 때 추가 요금을 결제했다 (고객)
  paymentAdditionalPaid('PAYMENT_ADDITIONAL_PAID'),

  /// 픽업 때 추가 요금을 결제하지 못했다 (고객)
  paymentAdditionalFailed('PAYMENT_ADDITIONAL_FAILED'),

  /// 결제한 금액을 돌려줬다 (고객)
  paymentRefunded('PAYMENT_REFUNDED'),

  /// 주문 메시지 — 푸시로만 온다
  orderMessage('ORDER_MESSAGE'),

  /// 기사 등록(또는 차량 변경) 승인
  driverApproved('DRIVER_APPROVED'),

  /// 기사 등록(또는 차량 변경) 반려
  driverRejected('DRIVER_REJECTED'),
  unknown('');

  const NotificationType(this._wire);
  final String _wire;

  static NotificationType parse(String wire) =>
      _parse(values, wire, (e) => e._wire);
}

/// 공지를 볼 사람.
enum NoticeAudience {
  all('ALL'),
  customer('CUSTOMER'),
  driver('DRIVER'),
  unknown('');

  const NoticeAudience(this._wire);
  final String _wire;

  static NoticeAudience parse(String wire) =>
      _parse(values, wire, (e) => e._wire);
}

/// 약관·정책의 종류.
enum LegalDocumentType {
  /// 서비스 이용약관
  terms('TERMS'),

  /// 개인정보 처리방침
  privacy('PRIVACY'),

  /// 위치기반서비스 이용약관
  location('LOCATION'),

  /// 취소·환불 규정
  refund('REFUND'),

  /// 기사 운송 약관 — 기사 앱에만 온다
  driver('DRIVER'),

  /// 마케팅 정보 수신 동의
  marketing('MARKETING'),
  unknown('');

  const LegalDocumentType(this._wire);
  final String _wire;

  String get wire => _toWire(this, _wire);
  static LegalDocumentType parse(String wire) =>
      _parse(values, wire, (e) => e._wire);
}

/// 푸시를 받는 기기 종류.
enum PushPlatform {
  android('ANDROID'),
  ios('IOS');

  const PushPlatform(this.wire);
  final String wire;
}

/// 고객이 고르는 큰 짐 운반 도움.
enum LoadingHelp {
  /// 고객이 직접 옮긴다
  none('NONE'),

  /// 기사와 함께 옮긴다
  together('TOGETHER'),

  /// 기사가 혼자 옮긴다
  driverOnly('DRIVER_ONLY'),
  unknown('');

  const LoadingHelp(this._wire);
  final String _wire;

  String get wire => _toWire(this, _wire);
  static LoadingHelp parse(String wire) => _parse(values, wire, (e) => e._wire);
}

/// 카드 종류.
enum CardType {
  credit('CREDIT'),
  check('CHECK'),
  unknown('');

  const CardType(this._wire);
  final String _wire;

  String get wire => _toWire(this, _wire);
  static CardType parse(String wire) => _parse(values, wire, (e) => e._wire);
}

/// 카드 등록 화면을 그리는 PG사 연동.
enum CardProvider {
  /// 개발용 — 돈이 오가지 않는다. 앱이 카드사·끝 4자리를 고르는 화면을 띄운다.
  dev('DEV'),

  /// 포트원 카드 등록 창 (PG사는 포트원 채널이 정한다 — MOVO는 나이스페이먼츠).
  portone('PORTONE'),
  unknown('');

  const CardProvider(this._wire);
  final String _wire;

  String get wire => _toWire(this, _wire);
  static CardProvider parse(String wire) =>
      _parse(values, wire, (e) => e._wire);
}

/// 주문의 결제 상태.
enum PaymentStatus {
  /// 아직 결제하지 않았다 (배차 전)
  unpaid('UNPAID'),
  paid('PAID'),

  /// 배차 때 결제가 안 됐다
  failed('FAILED'),
  partiallyRefunded('PARTIALLY_REFUNDED'),
  refunded('REFUNDED'),
  unknown('');

  const PaymentStatus(this._wire);
  final String _wire;

  String get wire => _toWire(this, _wire);
  static PaymentStatus parse(String wire) =>
      _parse(values, wire, (e) => e._wire);
}

/// 주문의 결제 한 건이 무엇인지.
enum ChargeKind {
  /// 배차될 때 결제한 요금
  dispatch('DISPATCH'),

  /// 픽업할 때 더 결제한 추가 요금과 대기료
  additional('ADDITIONAL'),
  unknown('');

  const ChargeKind(this._wire);
  final String _wire;

  String get wire => _toWire(this, _wire);
  static ChargeKind parse(String wire) => _parse(values, wire, (e) => e._wire);
}

/// 카드 결제 한 건의 상태.
enum ChargeStatus {
  paid('PAID'),
  failed('FAILED'),
  partiallyCancelled('PARTIALLY_CANCELLED'),
  cancelled('CANCELLED'),
  unknown('');

  const ChargeStatus(this._wire);
  final String _wire;

  String get wire => _toWire(this, _wire);
  static ChargeStatus parse(String wire) =>
      _parse(values, wire, (e) => e._wire);
}

/// 정산 계좌의 본인 확인 상태.
enum AccountVerificationStatus {
  /// 아직 확인하지 않았다
  unverified('UNVERIFIED'),

  /// 예금주가 가입자 본인이다
  verified('VERIFIED'),

  /// 확인하지 못했다 (사유가 함께 온다) — 정산이 보류된다
  failed('FAILED'),
  unknown('');

  const AccountVerificationStatus(this._wire);
  final String _wire;

  String get wire => _toWire(this, _wire);
  static AccountVerificationStatus parse(String wire) =>
      _parse(values, wire, (e) => e._wire);
}

/// 한 주 정산의 상태.
enum SettlementStatus {
  /// 이번 주 — 아직 운행 중이다
  inProgress('IN_PROGRESS'),

  /// 지급 대기
  waiting('WAITING'),

  /// 지급 중 — 이체 결과를 기다린다
  paying('PAYING'),
  paid('PAID'),

  /// 지급 실패 — 다시 지급된다
  failed('FAILED'),

  /// 보류 — 계좌가 없거나 본인 명의로 확인되지 않았다
  hold('HOLD'),
  unknown('');

  const SettlementStatus(this._wire);
  final String _wire;

  String get wire => _toWire(this, _wire);
  static SettlementStatus parse(String wire) =>
      _parse(values, wire, (e) => e._wire);
}
