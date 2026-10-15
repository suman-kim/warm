import '../json.dart';
import 'enums.dart';

/// 등록한 결제 카드. 카드 번호는 서버에도 없다 — PG사의 빌링키로 결제한다.
class PaymentMethod {
  const PaymentMethod({
    required this.id,
    required this.cardBrand,
    required this.cardLast4,
    required this.cardType,
    required this.isDefault,
    required this.createdAt,
  });

  factory PaymentMethod.fromJson(Json json) => PaymentMethod(
    id: json['id'] as String,
    cardBrand: json['cardBrand'] as String,
    cardLast4: json['cardLast4'] as String,
    cardType: CardType.parse(json['cardType'] as String),
    isDefault: json['isDefault'] as bool,
    createdAt: parseDate(json['createdAt']),
  );

  final String id;

  /// 카드사 (예: 신한카드)
  final String cardBrand;

  /// 카드 번호 끝 4자리
  final String cardLast4;
  final CardType cardType;

  /// 배송을 요청할 때 먼저 선택되는 카드
  final bool isDefault;
  final DateTime createdAt;

  /// 신한카드 ••4821
  String get label => '$cardBrand ••$cardLast4';
}

/// 카드 등록 화면을 열 때 쓰는 값.
class CardRegistration {
  const CardRegistration({
    required this.provider,
    required this.storeId,
    required this.channelKey,
    required this.customerKey,
  });

  factory CardRegistration.fromJson(Json json) => CardRegistration(
    provider: CardProvider.parse(json['provider'] as String),
    storeId: json['storeId'] as String?,
    channelKey: json['channelKey'] as String?,
    customerKey: json['customerKey'] as String,
  );

  /// [CardProvider.dev]면 PG사 화면 대신 개발용 카드 등록 화면을,
  /// [CardProvider.portone]이면 포트원 카드 등록 창을 띄운다.
  final CardProvider provider;

  /// 포트원 상점 ID. 개발용이면 null.
  final String? storeId;

  /// 포트원 채널 키 (어느 PG사로 카드를 등록할지). 개발용이면 null.
  final String? channelKey;

  /// PG사에 넘기는 고객 키 (회원마다 고정)
  final String customerKey;
}

/// 결제한(할) 카드.
class PaymentCard {
  const PaymentCard({
    required this.brand,
    required this.last4,
    required this.type,
  });

  factory PaymentCard.fromJson(Json json) => PaymentCard(
    brand: json['brand'] as String,
    last4: json['last4'] as String,
    type: CardType.parse(json['type'] as String),
  );

  final String brand;
  final String last4;
  final CardType type;

  /// 신한카드 ••4821
  String get label => '$brand ••$last4';
}

/// 결제가 안 된 사유와 해결 방법.
class PaymentFailure {
  const PaymentFailure({
    required this.code,
    required this.title,
    required this.guidance,
  });

  factory PaymentFailure.fromJson(Json json) => PaymentFailure(
    code: json['code'] as String,
    title: json['title'] as String,
    guidance: json['guidance'] as String,
  );

  /// 예: LIMIT_EXCEEDED
  final String code;

  /// 예: 한도 초과
  final String title;

  /// 고객에게 보여 줄 해결 방법
  final String guidance;
}

/// 카드 결제 한 건.
class Charge {
  const Charge({
    required this.id,
    required this.kind,
    required this.amount,
    required this.status,
    required this.card,
    required this.approvalNumber,
    required this.approvedAt,
    required this.failure,
    required this.failedAt,
    required this.cancelledAmount,
    required this.cancelledAt,
  });

  factory Charge.fromJson(Json json) => Charge(
    id: json['id'] as String,
    kind: ChargeKind.parse(json['kind'] as String),
    amount: (json['amount'] as num).toInt(),
    status: ChargeStatus.parse(json['status'] as String),
    card: PaymentCard.fromJson(json['card'] as Json),
    approvalNumber: json['approvalNumber'] as String?,
    approvedAt: parseDateOrNull(json['approvedAt']),
    failure: json['failure'] == null
        ? null
        : PaymentFailure.fromJson(json['failure'] as Json),
    failedAt: parseDateOrNull(json['failedAt']),
    cancelledAmount: (json['cancelledAmount'] as num).toInt(),
    cancelledAt: parseDateOrNull(json['cancelledAt']),
  );

  final String id;
  final ChargeKind kind;
  final int amount;
  final ChargeStatus status;
  final PaymentCard card;
  final String? approvalNumber;
  final DateTime? approvedAt;
  final PaymentFailure? failure;
  final DateTime? failedAt;

  /// 돌려준 금액
  final int cancelledAmount;
  final DateTime? cancelledAt;
}

/// 돌려준 한 건.
class Refund {
  const Refund({
    required this.amount,
    required this.reason,
    required this.automatic,
    required this.refundedAt,
  });

  factory Refund.fromJson(Json json) => Refund(
    amount: (json['amount'] as num).toInt(),
    reason: json['reason'] as String,
    automatic: json['automatic'] as bool,
    refundedAt: parseDate(json['refundedAt']),
  );

  final int amount;
  final String reason;

  /// 고객이 취소해 자동으로 돌려줬는지 (아니면 고객센터가 돌려줬다)
  final bool automatic;
  final DateTime refundedAt;
}

/// 주문의 결제 정보. 고객만 받는다.
class OrderPayment {
  const OrderPayment({
    required this.status,
    required this.card,
    required this.paidAmount,
    required this.refundedAmount,
    required this.unpaidAmount,
    required this.paidAt,
    required this.additionalPaidAt,
    required this.refundedAt,
    required this.charges,
    required this.refunds,
  });

  factory OrderPayment.fromJson(Json json) => OrderPayment(
    status: PaymentStatus.parse(json['status'] as String),
    card: json['card'] == null
        ? null
        : PaymentCard.fromJson(json['card'] as Json),
    paidAmount: (json['paidAmount'] as num).toInt(),
    refundedAmount: (json['refundedAmount'] as num).toInt(),
    unpaidAmount: (json['unpaidAmount'] as num).toInt(),
    paidAt: parseDateOrNull(json['paidAt']),
    additionalPaidAt: parseDateOrNull(json['additionalPaidAt']),
    refundedAt: parseDateOrNull(json['refundedAt']),
    charges: [
      for (final charge in json['charges'] as List<dynamic>)
        Charge.fromJson(charge as Json),
    ],
    refunds: [
      for (final refund in json['refunds'] as List<dynamic>)
        Refund.fromJson(refund as Json),
    ],
  );

  final PaymentStatus status;

  /// 결제한 카드. 결제 전이면 결제할 카드. 카드가 없으면 null.
  final PaymentCard? card;

  /// 결제한 금액의 합 (돌려준 금액을 빼기 전)
  final int paidAmount;
  final int refundedAmount;

  /// 결제가 안 된 추가 요금 (픽업 때 추가 결제가 실패한 경우)
  final int unpaidAmount;

  /// 배차 때 결제한 시각
  final DateTime? paidAt;

  /// 추가 요금을 결제한 시각
  final DateTime? additionalPaidAt;
  final DateTime? refundedAt;
  final List<Charge> charges;
  final List<Refund> refunds;

  /// 최종 결제 금액 = 결제한 금액 − 돌려준 금액
  int get finalAmount => paidAmount - refundedAmount;

  /// 결제한 것 중 픽업 때의 추가 결제
  Charge? get additionalCharge => charges
      .where(
        (charge) =>
            charge.kind == ChargeKind.additional &&
            charge.status != ChargeStatus.failed,
      )
      .firstOrNull;
}

/// 영수증 (앱 안에서 보는 카드 매출전표).
class Receipt {
  const Receipt({
    required this.orderId,
    required this.code,
    required this.paidAmount,
    required this.supplyAmount,
    required this.vat,
    required this.refundedAmount,
    required this.finalAmount,
    required this.cancellationFee,
    required this.card,
    required this.approvalNumbers,
    required this.paidAt,
    required this.additionalPaidAt,
    required this.refundedAt,
  });

  factory Receipt.fromJson(Json json) => Receipt(
    orderId: json['orderId'] as String,
    code: json['code'] as String,
    paidAmount: (json['paidAmount'] as num).toInt(),
    supplyAmount: (json['supplyAmount'] as num).toInt(),
    vat: (json['vat'] as num).toInt(),
    refundedAmount: (json['refundedAmount'] as num).toInt(),
    finalAmount: (json['finalAmount'] as num).toInt(),
    cancellationFee: (json['cancellationFee'] as num).toInt(),
    card: json['card'] == null
        ? null
        : PaymentCard.fromJson(json['card'] as Json),
    approvalNumbers: [
      for (final number in json['approvalNumbers'] as List<dynamic>)
        number as String,
    ],
    paidAt: parseDateOrNull(json['paidAt']),
    additionalPaidAt: parseDateOrNull(json['additionalPaidAt']),
    refundedAt: parseDateOrNull(json['refundedAt']),
  );

  final String orderId;

  /// 주문번호 (예: MV261013-3F9A)
  final String code;

  /// 결제한 금액의 합
  final int paidAmount;

  /// 결제한 금액에 들어 있는 공급가액과 부가세
  final int supplyAmount;
  final int vat;
  final int refundedAmount;

  /// 최종 결제 금액 = 결제한 금액 − 돌려준 금액
  final int finalAmount;
  final int cancellationFee;
  final PaymentCard? card;

  /// 승인번호 (결제한 순서)
  final List<String> approvalNumbers;
  final DateTime? paidAt;
  final DateTime? additionalPaidAt;
  final DateTime? refundedAt;
}

/// 요금에 붙는 것들의 규칙. 견적·안내·취소 규정 화면에 그대로 쓴다.
class ChargeRules {
  const ChargeRules({
    required this.helpFees,
    required this.stairFeePerFloor,
    required this.overloadUnitPrice,
    required this.bulkyUnitPrice,
    required this.stairsUnitPrice,
    required this.freeWaitingMinutes,
    required this.waitingFeePerMinute,
    required this.cancellationFeePercent,
    required this.noShowWaitMinutes,
  });

  factory ChargeRules.fromJson(Json json) {
    final help = json['helpFees'] as Json;
    final extra = json['extraUnitPrices'] as Json;
    return ChargeRules(
      helpFees: {
        for (final entry in help.entries)
          if (LoadingHelp.parse(entry.key) != LoadingHelp.unknown)
            LoadingHelp.parse(entry.key): (entry.value as num).toInt(),
      },
      stairFeePerFloor: (json['stairFeePerFloor'] as num).toInt(),
      overloadUnitPrice: (extra['overload'] as num).toInt(),
      bulkyUnitPrice: (extra['bulky'] as num).toInt(),
      stairsUnitPrice: (extra['stairs'] as num).toInt(),
      freeWaitingMinutes: (json['freeWaitingMinutes'] as num).toInt(),
      waitingFeePerMinute: (json['waitingFeePerMinute'] as num).toInt(),
      cancellationFeePercent: (json['cancellationFeePercent'] as num).toInt(),
      noShowWaitMinutes: (json['noShowWaitMinutes'] as num).toInt(),
    );
  }

  /// 큰 짐 운반 도움 요금
  final Map<LoadingHelp, int> helpFees;

  /// 엘리베이터가 없을 때 2층부터 한 층에 붙는 계단 요금
  final int stairFeePerFloor;

  /// 기사가 넣는 추가 요금의 단가: 과적 한 단계, 큰 짐 한 개, 계단 한 층
  final int overloadUnitPrice;
  final int bulkyUnitPrice;
  final int stairsUnitPrice;
  final int freeWaitingMinutes;
  final int waitingFeePerMinute;

  /// 기사가 출발한 뒤 취소할 때의 수수료율(%)
  final int cancellationFeePercent;

  /// 기사가 도착하고 노쇼를 신고할 수 있게 되기까지(분)
  final int noShowWaitMinutes;

  int helpFeeOf(LoadingHelp help) => helpFees[help] ?? 0;

  /// 엘리베이터가 없는 곳의 계단 요금 (2층부터)
  int stairFeeOf(int floor, {required bool elevator}) =>
      elevator ? 0 : (floor - 1).clamp(0, 99) * stairFeePerFloor;

  /// 기다린 시간의 대기료
  int waitingFeeOf(int minutes) =>
      (minutes - freeWaitingMinutes).clamp(0, 1 << 20) * waitingFeePerMinute;

  /// 출발 뒤 취소 수수료 (100원 단위 반올림)
  int cancellationFeeOf(int fare) =>
      (fare * cancellationFeePercent / 100 / 100).round() * 100;
}

/// 사업자 정보. 서버에 적지 않은 칸은 null.
class BusinessInfo {
  const BusinessInfo({
    required this.name,
    required this.representative,
    required this.registrationNumber,
    required this.mailOrderNumber,
    required this.address,
    required this.phone,
    required this.hours,
    required this.email,
  });

  factory BusinessInfo.fromJson(Json json) => BusinessInfo(
    name: json['name'] as String?,
    representative: json['representative'] as String?,
    registrationNumber: json['registrationNumber'] as String?,
    mailOrderNumber: json['mailOrderNumber'] as String?,
    address: json['address'] as String?,
    phone: json['phone'] as String?,
    hours: json['hours'] as String?,
    email: json['email'] as String?,
  );

  /// 상호
  final String? name;

  /// 대표자
  final String? representative;

  /// 사업자등록번호
  final String? registrationNumber;

  /// 통신판매업 신고번호
  final String? mailOrderNumber;
  final String? address;

  /// 고객센터 전화
  final String? phone;
  final String? hours;
  final String? email;
}
