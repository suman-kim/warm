import '../json.dart';
import 'enums.dart';

/// 내 기사 정보 (차량, 심사 상태, 운행 상태와 오늘 운행 시간).
class Driver {
  const Driver({
    required this.id,
    required this.userId,
    required this.vehicleType,
    required this.vehicleNumber,
    required this.status,
    required this.available,
    required this.rejectionReason,
    required this.approvedAt,
    required this.createdAt,
    required this.onlineSince,
    required this.todayOnline,
  });

  factory Driver.fromJson(Json json) => Driver(
    id: json['id'] as String,
    userId: json['userId'] as String,
    vehicleType: VehicleType.parse(json['vehicleType'] as String),
    vehicleNumber: json['vehicleNumber'] as String,
    status: DriverStatus.parse(json['status'] as String),
    available: json['available'] as bool,
    rejectionReason: json['rejectionReason'] as String?,
    approvedAt: parseDateOrNull(json['approvedAt']),
    createdAt: parseDate(json['createdAt']),
    onlineSince: parseDateOrNull(json['onlineSince']),
    todayOnline: Duration(seconds: (json['todayOnlineSeconds'] as num).toInt()),
  );

  final String id;
  final String userId;
  final VehicleType vehicleType;
  final String vehicleNumber;
  final DriverStatus status;

  /// 운행 중(온라인) 여부. 승인된 기사만 켤 수 있다.
  final bool available;

  /// 반려됐을 때 운영자가 적은 사유.
  final String? rejectionReason;
  final DateTime? approvedAt;
  final DateTime createdAt;

  /// 지금 운행 중이면 운행을 켠 시각, 아니면 null.
  final DateTime? onlineSince;

  /// 오늘(한국 날짜) 운행한 시간. 지금 켜져 있는 운행은 응답을 받은 시점까지 들어 있다 —
  /// 화면에서 시간이 흐르게 하려면 [onlineSince]로 이어서 센다.
  final Duration todayOnline;

  /// 지금 배차 대기 주문을 보고 수락할 수 있는지.
  bool get canAcceptOrders => status == DriverStatus.approved && available;
}

/// 서류 한 종류의 상태. 아직 올리지 않은 서류도 목록에 들어 있다.
class DriverDocument {
  const DriverDocument({
    required this.type,
    required this.status,
    required this.rejectionReason,
    required this.uploadedAt,
  });

  factory DriverDocument.fromJson(Json json) => DriverDocument(
    type: DriverDocumentType.parse(json['type'] as String),
    status: DriverDocumentStatus.parse(json['status'] as String),
    rejectionReason: json['rejectionReason'] as String?,
    uploadedAt: parseDateOrNull(json['uploadedAt']),
  );

  final DriverDocumentType type;
  final DriverDocumentStatus status;

  /// 반려됐을 때 운영자가 적은 사유.
  final String? rejectionReason;
  final DateTime? uploadedAt;

  /// 올려야(또는 다시 올려야) 신청할 수 있는 서류인지.
  bool get needsUpload =>
      status == DriverDocumentStatus.notSubmitted ||
      status == DriverDocumentStatus.rejected;
}

/// 정산 계좌. 계좌번호는 끝 네 자리만 온다.
class SettlementAccount {
  const SettlementAccount({
    required this.bankName,
    required this.maskedAccountNumber,
    required this.accountHolder,
    required this.verificationStatus,
    required this.verificationFailureReason,
    required this.verificationAttemptedAt,
    required this.verifiedAt,
  });

  factory SettlementAccount.fromJson(Json json) => SettlementAccount(
    bankName: json['bankName'] as String,
    maskedAccountNumber: json['maskedAccountNumber'] as String,
    accountHolder: json['accountHolder'] as String,
    verificationStatus: AccountVerificationStatus.parse(
      json['verificationStatus'] as String,
    ),
    verificationFailureReason: json['verificationFailureReason'] as String?,
    verificationAttemptedAt: parseDateOrNull(json['verificationAttemptedAt']),
    verifiedAt: parseDateOrNull(json['verifiedAt']),
  );

  final String bankName;

  /// 예: ••••1024
  final String maskedAccountNumber;
  final String accountHolder;

  /// 본인 명의 확인. [AccountVerificationStatus.verified]가 아니면 정산이 보류된다.
  final AccountVerificationStatus verificationStatus;

  /// 확인하지 못한 사유 (예: 예금주 이름이 가입자 이름과 달라요.)
  final String? verificationFailureReason;

  /// 마지막으로 확인을 시도한 시각
  final DateTime? verificationAttemptedAt;
  final DateTime? verifiedAt;

  bool get isVerified =>
      verificationStatus == AccountVerificationStatus.verified;
}

/// 한 주의 정산 (기사용).
class SettlementWeek {
  const SettlementWeek({
    required this.weekStart,
    required this.weekEnd,
    required this.payoutDate,
    required this.status,
    required this.reason,
    required this.trips,
    required this.gross,
    required this.extraFare,
    required this.fee,
    required this.compensation,
    required this.net,
    required this.paidAt,
    required this.bankName,
    required this.maskedAccountNumber,
  });

  factory SettlementWeek.fromJson(Json json) => SettlementWeek(
    weekStart: json['weekStart'] as String,
    weekEnd: json['weekEnd'] as String,
    payoutDate: json['payoutDate'] as String,
    status: SettlementStatus.parse(json['status'] as String),
    reason: json['reason'] as String?,
    trips: (json['trips'] as num).toInt(),
    gross: (json['gross'] as num).toInt(),
    extraFare: (json['extraFare'] as num).toInt(),
    fee: (json['fee'] as num).toInt(),
    compensation: (json['compensation'] as num).toInt(),
    net: (json['net'] as num).toInt(),
    paidAt: parseDateOrNull(json['paidAt']),
    bankName: json['bankName'] as String?,
    maskedAccountNumber: json['maskedAccountNumber'] as String?,
  );

  /// 주의 시작(월요일)과 끝(일요일), 한국 날짜 `YYYY-MM-DD`
  final String weekStart;
  final String weekEnd;

  /// 지급(예정)일, 한국 날짜
  final String payoutDate;
  final SettlementStatus status;

  /// 보류·실패 사유
  final String? reason;

  /// 완료한 배송 수
  final int trips;

  /// 운행 매출 — 완료한 배송의 최종 요금 합
  final int gross;

  /// 그중 추가 요금과 대기료
  final int extraFare;

  /// 수수료
  final int fee;

  /// 취소·노쇼 보상
  final int compensation;

  /// 정산액 = 운행 매출 − 수수료 + 취소·노쇼 보상
  final int net;
  final DateTime? paidAt;
  final String? bankName;
  final String? maskedAccountNumber;
}

/// 기사의 정산 내역.
class DriverSettlements {
  const DriverSettlements({
    required this.commissionPercent,
    required this.payoutWeekday,
    required this.account,
    required this.onHold,
    required this.current,
    required this.upcoming,
    required this.paid,
  });

  factory DriverSettlements.fromJson(Json json) {
    final account = json['account'] as Json?;
    return DriverSettlements(
      commissionPercent: json['commissionPercent'] as num,
      payoutWeekday: (json['payoutWeekday'] as num).toInt(),
      account: account == null
          ? null
          : SettlementAccountSummary(
              bankName: account['bankName'] as String,
              maskedAccountNumber: account['maskedAccountNumber'] as String,
              verified: account['verified'] as bool,
              verificationFailureReason:
                  account['verificationFailureReason'] as String?,
            ),
      onHold: json['onHold'] as bool,
      current: SettlementWeek.fromJson(json['current'] as Json),
      upcoming: [
        for (final week in json['upcoming'] as List<dynamic>)
          SettlementWeek.fromJson(week as Json),
      ],
      paid: [
        for (final week in json['paid'] as List<dynamic>)
          SettlementWeek.fromJson(week as Json),
      ],
    );
  }

  /// 수수료율(%)
  final num commissionPercent;

  /// 지급 요일. 0 = 일요일 … 6 = 토요일
  final int payoutWeekday;

  /// 정산 계좌. 등록하지 않았으면 null.
  final SettlementAccountSummary? account;

  /// 계좌가 없거나 본인 명의로 확인되지 않아 정산이 보류되는지
  final bool onHold;

  /// 이번 주 (진행 중)
  final SettlementWeek current;

  /// 지급 예정 (끝났지만 아직 지급하지 않은 주, 최근 주부터)
  final List<SettlementWeek> upcoming;

  /// 지급 완료 (최근 주부터)
  final List<SettlementWeek> paid;
}

/// 정산 내역에 붙는 계좌 요약.
class SettlementAccountSummary {
  const SettlementAccountSummary({
    required this.bankName,
    required this.maskedAccountNumber,
    required this.verified,
    required this.verificationFailureReason,
  });

  final String bankName;
  final String maskedAccountNumber;
  final bool verified;
  final String? verificationFailureReason;
}

/// 하루치 수입.
class DailyEarnings {
  const DailyEarnings({
    required this.date,
    required this.earnings,
    required this.sales,
    required this.completedCount,
  });

  factory DailyEarnings.fromJson(Json json) => DailyEarnings(
    date: json['date'] as String,
    earnings: (json['earnings'] as num).toInt(),
    sales:
        (json['sales'] as num?)?.toInt() ?? (json['earnings'] as num).toInt(),
    completedCount: (json['completedCount'] as num).toInt(),
  );

  /// 한국 날짜 (`YYYY-MM-DD`)
  final String date;

  /// 그날 받는 금액(원) — 매출에서 수수료를 빼고 취소 보상을 더한 값
  final int earnings;

  /// 그날 매출(원) — 완료한 배송의 최종 요금 합 (수수료를 빼기 전)
  final int sales;
  final int completedCount;
}

/// 기사 수입. 기간의 날짜별 수입과 다음 정산 예정.
class Earnings {
  const Earnings({
    required this.from,
    required this.to,
    required this.totalEarnings,
    required this.totalSales,
    required this.completedCount,
    required this.cancelledCount,
    required this.noShowCount,
    required this.daily,
    required this.nextSettlementDate,
    required this.nextSettlementAmount,
  });

  factory Earnings.fromJson(Json json) {
    final settlement = json['nextSettlement'] as Json;
    return Earnings(
      from: json['from'] as String,
      to: json['to'] as String,
      totalEarnings: (json['totalEarnings'] as num).toInt(),
      totalSales:
          (json['totalSales'] as num?)?.toInt() ??
          (json['totalEarnings'] as num).toInt(),
      completedCount: (json['completedCount'] as num).toInt(),
      cancelledCount: (json['cancelledCount'] as num).toInt(),
      noShowCount: (json['noShowCount'] as num?)?.toInt() ?? 0,
      daily: [
        for (final day in json['daily'] as List<dynamic>)
          DailyEarnings.fromJson(day as Json),
      ],
      nextSettlementDate: settlement['date'] as String,
      nextSettlementAmount: (settlement['amount'] as num).toInt(),
    );
  }

  /// 기간의 양 끝 (한국 날짜, 그날 포함)
  final String from;
  final String to;

  /// 받는 금액 합 (수수료를 뺀 값)
  final int totalEarnings;

  /// 매출 합 (수수료를 빼기 전)
  final int totalSales;
  final int completedCount;

  /// 배차된 뒤 고객이 취소한 건수 (취소 보상만 수입에 들어간다)
  final int cancelledCount;

  /// 노쇼로 끝난 건수
  final int noShowCount;

  /// 기간의 모든 날짜가 순서대로 온다 (수입이 없는 날은 0)
  final List<DailyEarnings> daily;

  /// 다음 입금일 (한국 날짜, `YYYY-MM-DD`)
  final String nextSettlementDate;

  /// 다음 입금 예정 금액(원). 조회한 기간과 무관하다.
  final int nextSettlementAmount;
}
