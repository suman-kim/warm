// 서버가 문자열로 주고받는 값들.
//
// 각 enum의 `unknown`은 이 버전의 앱이 모르는 값이다. 서버에 값이 추가돼도(새 상태 등)
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
  /// 배달을 요청하는 가게 사장님
  customer('CUSTOMER'),

  /// 배달 라이더
  driver('DRIVER'),

  /// 운영자
  admin('ADMIN'),
  unknown('');

  const UserRole(this._wire);
  final String _wire;

  String get wire => _toWire(this, _wire);
  static UserRole parse(String wire) => _parse(values, wire, (e) => e._wire);
}

/// 라이더의 이동 수단. 지금은 오토바이뿐이다.
enum VehicleType {
  motorcycle('MOTORCYCLE'),
  unknown('');

  const VehicleType(this._wire);
  final String _wire;

  String get wire => _toWire(this, _wire);
  static VehicleType parse(String wire) => _parse(values, wire, (e) => e._wire);
}

/// 배달 상태.
///
/// requested → assigned → departed → arrived → pickedUp → delivered.
/// 가게는 픽업 전까지 취소할 수 있다.
enum OrderStatus {
  /// 배차 대기 — 라이더가 수락할 수 있다
  requested('REQUESTED'),

  /// 배차 완료 — 라이더가 출발하기 전 (지금 취소하면 수수료가 없다)
  assigned('ASSIGNED'),

  /// 라이더가 가게로 출발했다 (지금 취소하면 대행료의 15%)
  departed('DEPARTED'),

  /// 라이더가 가게에 도착해 음식을 기다린다
  arrived('ARRIVED'),

  /// 픽업 완료 — 손님에게 가는 중
  pickedUp('PICKED_UP'),

  /// 배달 완료
  delivered('DELIVERED'),

  /// 취소됨
  cancelled('CANCELLED'),
  unknown('');

  const OrderStatus(this._wire);
  final String _wire;

  String get wire => _toWire(this, _wire);
  static OrderStatus parse(String wire) => _parse(values, wire, (e) => e._wire);
}

/// 라이더 심사 상태.
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

/// 라이더 등록에 내는 서류.
enum DriverDocumentType {
  /// 운전면허증
  driverLicense('DRIVER_LICENSE'),

  /// 이륜차 사용신고필증 (오토바이의 차량 등록 서류)
  vehicleRegistration('VEHICLE_REGISTRATION'),

  /// 유상운송(배달용) 이륜차 보험 증권
  deliveryInsurance('DELIVERY_INSURANCE'),
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

/// 알림의 종류. 푸시의 `data.type`과 알림함의 `type`이 같은 값을 쓴다.
enum NotificationType {
  /// 새 콜 (라이더) — 푸시로만 오고 알림함에는 쌓이지 않는다
  orderRequested('ORDER_REQUESTED'),

  /// 라이더 배정 (가게)
  orderAssigned('ORDER_ASSIGNED'),

  /// 라이더가 가게로 출발했다 (가게)
  orderDeparted('ORDER_DEPARTED'),

  /// 라이더가 가게에 도착했다 (가게)
  orderArrived('ORDER_ARRIVED'),

  /// 픽업 완료 (가게)
  orderPickedUp('ORDER_PICKED_UP'),

  /// 배달 완료 (가게)
  orderDelivered('ORDER_DELIVERED'),

  /// 가게가 배차된 배달을 취소 (라이더)
  orderCancelled('ORDER_CANCELLED'),

  /// 라이더 등록(또는 오토바이 변경) 승인
  driverApproved('DRIVER_APPROVED'),

  /// 라이더 등록(또는 오토바이 변경) 반려
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

  /// 라이더 이용약관 — 라이더 앱에만 온다
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

/// 가게 심사 상태.
enum StoreStatus {
  /// 심사 대기 — 배달을 요청할 수 없다.
  pending('PENDING'),
  approved('APPROVED'),
  rejected('REJECTED'),
  unknown('');

  const StoreStatus(this._wire);
  final String _wire;

  String get wire => _toWire(this, _wire);
  static StoreStatus parse(String wire) => _parse(values, wire, (e) => e._wire);
}

/// 충전금 내역의 종류.
enum WalletEntryKind {
  /// 충전 (+)
  topUp('TOP_UP'),

  /// 배달대행료 (−)
  deliveryFee('DELIVERY_FEE'),

  /// 취소된 배달의 대행료 환불 (+)
  refund('REFUND'),

  /// 운영자 조정 (±)
  adjustment('ADJUSTMENT'),
  unknown('');

  const WalletEntryKind(this._wire);
  final String _wire;

  String get wire => _toWire(this, _wire);
  static WalletEntryKind parse(String wire) =>
      _parse(values, wire, (e) => e._wire);
}

/// 음식값을 받는 방식.
enum DoorPayment {
  /// 배달앱에서 이미 결제 — 라이더는 돈을 받지 않는다.
  prepaid('PREPAID'),

  /// 만나서 현금
  cash('CASH'),

  /// 만나서 카드 (라이더의 휴대용 단말기)
  card('CARD'),
  unknown('');

  const DoorPayment(this._wire);
  final String _wire;

  String get wire => _toWire(this, _wire);
  static DoorPayment parse(String wire) => _parse(values, wire, (e) => e._wire);

  /// 라이더가 손님에게 돈을 받는지.
  bool get collectsAtDoor => this == cash || this == card;
}
