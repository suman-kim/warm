import 'models/enums.dart';

/// 이 패키지가 던지는 모든 오류의 기반. 화면에서는 종류별로 나눠 처리한다:
/// [ApiException](서버가 거절), [NetworkException](서버에 닿지 못함),
/// [WrongAppException](다른 앱의 계정), [UnexpectedResponseException](응답을 읽을 수 없음).
sealed class MovoException implements Exception {
  const MovoException();

  String get message;

  @override
  String toString() => '$runtimeType: $message';
}

/// 서버가 요청을 거절했다. 응답의 `{ statusCode, code, message }`를 그대로 담는다.
class ApiException extends MovoException {
  const ApiException({
    required this.statusCode,
    required this.code,
    required this.messages,
  });

  final int statusCode;

  /// 분기에 쓰는 기계용 코드. 자주 쓰는 값은 [ApiErrorCode]에 있다.
  final String code;

  /// 서버가 보낸 메시지. 대부분 한 줄이고 사용자에게 그대로 보여줄 수 있는 한국어다.
  /// 입력 검증 실패([ApiErrorCode.validationFailed])만 항목별 영어 메시지가 여러 줄 온다.
  final List<String> messages;

  @override
  String get message => messages.join('\n');

  @override
  String toString() => 'ApiException($statusCode $code): $message';
}

/// 로그인이 풀렸다 — 리프레시 토큰이 만료됐거나 폐기됐다. 저장된 토큰은 이미 지워졌다.
/// 로그인 화면으로 보내는 일은 [MovoApi.sessionExpired]를 한 곳에서 구독해 처리한다.
class SessionExpiredException extends ApiException {
  const SessionExpiredException({required super.messages})
    : super(statusCode: 401, code: ApiErrorCode.sessionExpired);
}

/// 이 앱의 계정이 아니다 (가게 앱에 라이더 계정으로 로그인하는 경우 등). 로그인되지 않는다.
class WrongAppException extends MovoException {
  const WrongAppException({required this.expected, required this.actual});

  final UserRole expected;
  final UserRole actual;

  @override
  String get message => '이 앱에서는 사용할 수 없는 계정이에요.';
}

/// 서버에 닿지 못했다 (연결 끊김, 시간 초과 등). 같은 요청을 다시 시도해 볼 수 있다.
class NetworkException extends MovoException {
  const NetworkException({this.cause});

  final Object? cause;

  @override
  String get message => '서버에 연결할 수 없어요. 인터넷 연결을 확인해 주세요.';
}

/// 서버가 답했지만 읽을 수 없다 (JSON이 아니거나 모양이 다르다). 앱과 서버의 버전이 어긋났을 때 난다.
class UnexpectedResponseException extends MovoException {
  const UnexpectedResponseException(this.detail);

  final String detail;

  @override
  String get message => '서버 응답을 처리할 수 없어요.';

  @override
  String toString() => 'UnexpectedResponseException: $detail';
}

/// 화면에서 분기할 때 쓰는 오류 코드. 서버가 보내는 값 그대로다.
abstract final class ApiErrorCode {
  /// 이 패키지가 만드는 코드 — [SessionExpiredException].
  static const sessionExpired = 'SESSION_EXPIRED';

  /// 입력 검증 실패 (400). 앱에서 먼저 검증했다면 보통 나지 않는다.
  static const validationFailed = 'VALIDATION_FAILED';

  // 가입 · 인증
  static const invalidCredentials = 'INVALID_CREDENTIALS';
  static const emailAlreadyRegistered = 'EMAIL_ALREADY_REGISTERED';
  static const accountInactive = 'ACCOUNT_INACTIVE';

  /// 운영자가 이용을 정지한 계정. 메시지에 기간과 사유가 들어 있다.
  static const accountSuspended = 'ACCOUNT_SUSPENDED';

  /// 필수 약관에 동의하지 않았다.
  static const agreementRequired = 'AGREEMENT_REQUIRED';

  /// 비밀번호가 규칙(8자 이상, 영문과 숫자 포함)에 맞지 않는다.
  static const weakPassword = 'WEAK_PASSWORD';

  /// 인증 코드가 틀렸거나 만료됐거나 너무 많이 틀렸다 — 코드를 다시 받는다.
  static const invalidResetCode = 'INVALID_RESET_CODE';

  /// 탈퇴할 때 보낸 비밀번호가 틀렸다.
  static const passwordMismatch = 'PASSWORD_MISMATCH';

  /// 끝나지 않은 배달(라이더는 진행 중인 배달)이 있어 탈퇴할 수 없다.
  static const orderInProgress = 'ORDER_IN_PROGRESS';

  // 라이더
  static const driverNotRegistered = 'DRIVER_NOT_REGISTERED';
  static const driverAlreadyRegistered = 'DRIVER_ALREADY_REGISTERED';
  static const driverNotApproved = 'DRIVER_NOT_APPROVED';
  static const driverNotAvailable = 'DRIVER_NOT_AVAILABLE';

  /// 운행 중에는 오토바이를 바꿀 수 없다.
  static const driverIsOnline = 'DRIVER_IS_ONLINE';

  /// 서류를 모두 올려야 신청할 수 있다 (반려된 서류는 다시 올려야 한다).
  static const documentsRequired = 'DOCUMENTS_REQUIRED';

  /// 사진(JPG·PNG·WEBP·HEIC)이나 PDF가 아니다.
  static const unsupportedDocumentType = 'UNSUPPORTED_DOCUMENT_TYPE';
  static const documentTooLarge = 'DOCUMENT_TOO_LARGE';
  static const invalidSettlementAccount = 'INVALID_SETTLEMENT_ACCOUNT';
  static const settlementAccountNotFound = 'SETTLEMENT_ACCOUNT_NOT_FOUND';

  // 가게·충전금
  static const storeNotRegistered = 'STORE_NOT_REGISTERED';
  static const storeNotApproved = 'STORE_NOT_APPROVED';
  static const insufficientWalletBalance = 'INSUFFICIENT_WALLET_BALANCE';

  // 배달 요청
  /// 가게에서 10km 넘게 떨어진 손님이다.
  static const deliveryTooFar = 'DELIVERY_TOO_FAR';

  /// 만나서 결제는 받을 음식값이 있어야 한다.
  static const foodAmountRequired = 'FOOD_AMOUNT_REQUIRED';
  static const orderNotFound = 'ORDER_NOT_FOUND';

  /// 라이더가 픽업한 뒤에는 취소할 수 없다.
  static const orderNotCancellable = 'ORDER_NOT_CANCELLABLE';

  // 배차 — 수락이 늦었을 때는 [orderNotOpen] 또는 [staleAggregate]가 온다.
  static const orderNotOpen = 'ORDER_NOT_OPEN';
  static const staleAggregate = 'STALE_AGGREGATE';
  static const notAssignedDriver = 'NOT_ASSIGNED_DRIVER';
  static const orderNotAwaitingDeparture = 'ORDER_NOT_AWAITING_DEPARTURE';
  static const orderNotOnTheWay = 'ORDER_NOT_ON_THE_WAY';
  static const orderNotAwaitingPickup = 'ORDER_NOT_AWAITING_PICKUP';
  static const orderNotInTransit = 'ORDER_NOT_IN_TRANSIT';

  /// (라이더) 이미 3건을 맡고 있어 더 수락할 수 없다.
  static const tooManyActiveDeliveries = 'TOO_MANY_ACTIVE_DELIVERIES';

  /// (라이더) 만나서 결제하는 배달은 받은 방식과 금액을 넣어야 완료된다.
  static const collectionRequired = 'COLLECTION_REQUIRED';

  // 기간 조회 (수입, 배달 내역)
  static const invalidPeriod = 'INVALID_PERIOD';
  static const periodTooLong = 'PERIOD_TOO_LONG';

  // 그 밖
  /// 주소 검색 서비스(카카오)가 잠시 응답하지 않는다 (503).
  static const addressSearchUnavailable = 'ADDRESS_SEARCH_UNAVAILABLE';
  static const noticeNotFound = 'NOTICE_NOT_FOUND';
  static const legalDocumentNotFound = 'LEGAL_DOCUMENT_NOT_FOUND';
}
