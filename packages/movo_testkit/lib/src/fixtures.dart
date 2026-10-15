// 서버 응답 모양의 견본 값. 디자인에 나온 사람·주소·금액을 그대로 쓴다.
// 시각은 지금을 기준으로 만든다 — "약 7분 남음" 같은 문구가 언제 돌려도 같게 나오도록.

typedef Json = Map<String, dynamic>;

String isoAt(Duration fromNow) =>
    DateTime.now().add(fromNow).toUtc().toIso8601String();

Json userJson({
  String id = 'user-1',
  String role = 'CUSTOMER',
  String name = '김지은',
  String email = 'jieun.kim@gmail.com',
  String phone = '01012345678',
  bool marketingAgreed = false,
}) => {
  'id': id,
  'email': email,
  'name': name,
  'phone': phone,
  'role': role,
  'marketingAgreed': marketingAgreed,
  'createdAt': '2026-10-01T00:12:00.000Z',
};

Json driverUserJson() => userJson(
  id: 'user-2',
  role: 'DRIVER',
  name: '김도윤',
  email: 'doyun.kim@gmail.com',
  phone: '01098765432',
);

Json authJson(Json user) => {
  'accessToken': 'access',
  'refreshToken': 'refresh',
  'user': user,
};

const seongsu = {
  'address': '서울 성동구 성수이로 113',
  'detailAddress': '1층 정문',
  'sigungu': '성동구',
  'dong': '성수동2가',
  'latitude': 37.5445,
  'longitude': 127.0557,
  'contactName': '김지은',
  'contactPhone': '01012345678',
};

const yeoksam = {
  'address': '서울 강남구 테헤란로 152',
  'detailAddress': '강남파이낸스센터',
  'sigungu': '강남구',
  'dong': '역삼동',
  'latitude': 37.5000,
  'longitude': 127.0364,
  'contactName': '박서준',
  'contactPhone': '01055550123',
};

const boxes = {
  'category': 'BOX',
  'weightKg': 15,
  'quantity': 3,
  'description': null,
};

/// 주문. [status]에 맞는 시각이 채워진다 — 요청은 9분 전, 배차는 8분 전.
/// [fare]는 배차 때 결제하는 요금(기본 + 운반 도움 + 계단)이고, 추가 요금·대기료를 더하면 최종 요금이다.
Json orderJson({
  String id = 'order-1',
  String status = 'ASSIGNED',
  String vehicleType = 'DAMAS',
  String serviceType = 'QUICK',
  Json pickup = seongsu,
  Json dropoff = yeoksam,
  Json cargo = boxes,
  String? memo = '1층 경비실에 맡겨주세요',
  double distanceKm = 8.2,
  int durationMinutes = 32,
  int fare = 28000,
  String loadingHelp = 'NONE',
  int helpFee = 0,
  Json pickupAccess = const {'floor': 1, 'elevator': true},
  Json dropoffAccess = const {'floor': 1, 'elevator': true},
  int stairFee = 0,
  Json extraItems = const {'overload': 0, 'bulky': 0, 'stairs': 0},
  int extraFee = 0,
  int waitingMinutes = 0,
  int waitingFee = 0,
  int cancellationFee = 0,
  int? earning,
  String? driverName,
  Json? payment,
  Json? paymentFailure,
  String? scheduledPickupAt,
  Duration requestedAgo = const Duration(minutes: 9),
}) {
  final requested = -requestedAgo;
  final open = const [
    'REQUESTED',
    'PAYING',
    'PAYMENT_FAILED',
    'CANCELLED_OPEN',
  ].contains(status);
  final assigned = !open;
  final departed = const [
    'DEPARTED',
    'ARRIVED',
    'PICKED_UP',
    'DELIVERED',
    'NO_SHOW',
  ].contains(status);
  final arrived = const [
    'ARRIVED',
    'PICKED_UP',
    'DELIVERED',
    'NO_SHOW',
  ].contains(status);
  final pickedUp = status == 'PICKED_UP' || status == 'DELIVERED';
  final delivered = status == 'DELIVERED';
  final cancelled = status.startsWith('CANCELLED');
  final noShow = status == 'NO_SHOW';
  final finished = delivered || cancelled || noShow;
  final arrivedAt = requested + const Duration(minutes: 2);
  return {
    'id': id,
    'code':
        'MV261013-${id.replaceAll('-', '').toUpperCase().padRight(4, '0').substring(0, 4)}',
    'customerId': 'user-1',
    'status': cancelled ? 'CANCELLED' : status,
    'serviceType': serviceType,
    'vehicleType': vehicleType,
    'pickup': pickup,
    'dropoff': dropoff,
    'cargo': cargo,
    'memo': memo,
    'distanceKm': distanceKm,
    'durationMinutes': durationMinutes,
    'baseFare': fare - helpFee - stairFee,
    'loadingHelp': loadingHelp,
    'helpFee': helpFee,
    'pickupAccess': pickupAccess,
    'dropoffAccess': dropoffAccess,
    'stairFee': stairFee,
    'fare': fare,
    'extraItems': extraItems,
    'extraFee': extraFee,
    'waitingMinutes': waitingMinutes,
    'waitingFee': waitingFee,
    'totalFare': fare + extraFee + waitingFee,
    'cancellationFee': cancellationFee,
    'cancellationFeeNow': switch (status) {
      'REQUESTED' || 'PAYMENT_FAILED' || 'ASSIGNED' => 0,
      'DEPARTED' || 'ARRIVED' => ((fare * 15 / 100) / 100).round() * 100,
      _ => null,
    },
    'noShowAvailableAt': status == 'ARRIVED'
        ? isoAt(arrivedAt + const Duration(minutes: 30))
        : null,
    'paymentFailure': status == 'PAYMENT_FAILED'
        ? paymentFailure ??
              const {
                'code': 'LIMIT_EXCEEDED',
                'title': '한도 초과',
                'guidance': '카드 한도가 부족해요. 카드사 앱에서 한도를 확인하거나 다른 카드로 결제해 주세요.',
              }
        : null,
    // 기사가 받는 금액. 기사가 보는 주문에만 온다.
    'earning': ?earning,
    'driverId': assigned ? 'driver-1' : null,
    'driverName': ?(assigned ? driverName : null),
    // 결제 정보. 고객의 주문 목록에만 온다.
    'payment': ?payment,
    'scheduledPickupAt': scheduledPickupAt,
    'estimatedPickupAt': assigned && !cancelled
        ? isoAt(requested + const Duration(minutes: 16))
        : null,
    'estimatedDeliveryAt': assigned && !finished
        ? isoAt(requested + const Duration(minutes: 48))
        : null,
    'requestedAt': isoAt(requested),
    'assignedAt': assigned
        ? isoAt(requested + const Duration(minutes: 1))
        : null,
    'departedAt': departed
        ? isoAt(requested + const Duration(minutes: 1, seconds: 30))
        : null,
    'arrivedAt': arrived ? isoAt(arrivedAt) : null,
    'pickedUpAt': pickedUp
        ? isoAt(requested + const Duration(minutes: 3))
        : null,
    'deliveredAt': delivered
        ? isoAt(requested + const Duration(minutes: 8))
        : null,
    'cancelledAt': cancelled
        ? isoAt(requested + const Duration(minutes: 2))
        : null,
    'noShowAt': noShow ? isoAt(requested + const Duration(minutes: 8)) : null,
    'cancelReason': null,
  };
}

const shinhanCard = {'brand': '신한카드', 'last4': '4821', 'type': 'CREDIT'};

/// 주문의 결제 정보 (고객용). 기본은 배차 때 [paid]원을 결제했고 돌려준 것이 없다.
Json paymentJson({
  String status = 'PAID',
  int paid = 28000,
  int additional = 0,
  int refunded = 0,
  Json? card = shinhanCard,
  List<Json> refunds = const [],
}) => {
  'status': status,
  'card': card,
  'paidAmount': paid + additional,
  'refundedAmount': refunded,
  'unpaidAmount': 0,
  'paidAt': paid > 0 ? isoAt(const Duration(minutes: -8)) : null,
  'additionalPaidAt': additional > 0
      ? isoAt(const Duration(minutes: -4))
      : null,
  'refundedAt': refunded > 0 ? isoAt(const Duration(minutes: -2)) : null,
  'charges': [
    if (paid > 0)
      _charge('charge-1', 'DISPATCH', paid, card, '30521877', refunded),
    if (additional > 0)
      _charge('charge-2', 'ADDITIONAL', additional, card, '30522410', 0),
  ],
  'refunds': refunds,
};

Json _charge(
  String id,
  String kind,
  int amount,
  Json? card,
  String approval,
  int cancelled,
) => {
  'id': id,
  'kind': kind,
  'amount': amount,
  'status': cancelled == 0
      ? 'PAID'
      : cancelled == amount
      ? 'CANCELLED'
      : 'PARTIALLY_CANCELLED',
  'card': card ?? shinhanCard,
  'approvalNumber': approval,
  'approvedAt': isoAt(const Duration(minutes: -8)),
  'failure': null,
  'failedAt': null,
  'cancelledAmount': cancelled,
  'cancelledAt': cancelled > 0 ? isoAt(const Duration(minutes: -2)) : null,
};

/// 등록한 카드.
Json paymentMethodJson({
  String id = 'card-1',
  String brand = '신한카드',
  String last4 = '4821',
  String type = 'CREDIT',
  bool isDefault = true,
  String createdAt = '2026-08-03T01:00:00.000Z',
}) => {
  'id': id,
  'cardBrand': brand,
  'cardLast4': last4,
  'cardType': type,
  'isDefault': isDefault,
  'createdAt': createdAt,
};

/// 요금 규칙 (서버의 지금 값).
Json chargeRulesJson() => {
  'helpFees': {'NONE': 0, 'TOGETHER': 10000, 'DRIVER_ONLY': 20000},
  'stairFeePerFloor': 3000,
  'extraUnitPrices': {'overload': 10000, 'bulky': 10000, 'stairs': 3000},
  'freeWaitingMinutes': 10,
  'waitingFeePerMinute': 500,
  'cancellationFeePercent': 15,
  'noShowWaitMinutes': 30,
};

/// 영수증.
Json receiptJson({
  int paid = 56000,
  int refunded = 0,
  int cancellationFee = 0,
  List<String> approvals = const ['30521877', '30522410'],
}) {
  final vat = (paid / 11).round();
  return {
    'orderId': 'order-1',
    'code': 'MV261013-ORDE',
    'status': 'DELIVERED',
    'paidAmount': paid,
    'supplyAmount': paid - vat,
    'vat': vat,
    'refundedAmount': refunded,
    'finalAmount': paid - refunded,
    'cancellationFee': cancellationFee,
    'card': shinhanCard,
    'approvalNumbers': approvals,
    'paidAt': isoAt(const Duration(minutes: -48)),
    'additionalPaidAt': approvals.length > 1
        ? isoAt(const Duration(minutes: -25))
        : null,
    'refundedAt': refunded > 0 ? isoAt(const Duration(minutes: -5)) : null,
  };
}

/// 사업자 정보 (디자인의 예시 값).
Json businessJson() => {
  'name': '주식회사 무보',
  'representative': '한서윤',
  'registrationNumber': '214-88-01234',
  'mailOrderNumber': '제2026-서울성동-0812호',
  'address': '서울특별시 성동구 성수이로 113, 4층',
  'phone': '1600-0000',
  'hours': '평일 09:00–18:00',
  'email': 'help@movo.kr',
};

/// 정산 계좌.
Json settlementAccountJson({
  String status = 'VERIFIED',
  String holder = '김도윤',
}) => {
  'bankName': '국민은행',
  'maskedAccountNumber': '••••1024',
  'accountHolder': holder,
  'verificationStatus': status,
  'verificationFailureReason': status == 'FAILED'
      ? '예금주 이름이 가입자 이름과 달라요.'
      : null,
  'verificationAttemptedAt': '2026-10-12T12:04:00.000Z',
  'verifiedAt': status == 'VERIFIED' ? '2026-10-12T12:04:00.000Z' : null,
};

/// 기사의 한 주 정산.
Json settlementWeekJson({
  String weekStart = '2026-10-05',
  String weekEnd = '2026-10-11',
  String payoutDate = '2026-10-14',
  String status = 'WAITING',
  String? reason,
  int trips = 21,
  int gross = 612000,
  int extraFare = 54000,
  int compensation = 0,
  String? paidAt,
}) {
  final fee = (gross / 100).round() * 10;
  return {
    'weekStart': weekStart,
    'weekEnd': weekEnd,
    'payoutDate': payoutDate,
    'status': status,
    'reason': reason,
    'trips': trips,
    'gross': gross,
    'extraFare': extraFare,
    'fee': fee,
    'compensation': compensation,
    'net': gross - fee + compensation,
    'paidAt': paidAt,
    'bankName': '국민은행',
    'maskedAccountNumber': '••••1024',
  };
}

/// 기사의 정산 내역.
Json driverSettlementsJson({
  bool verified = true,
  bool hasAccount = true,
  List<Json>? upcoming,
  List<Json>? paid,
}) => {
  'commissionPercent': 10,
  'payoutWeekday': 2,
  'account': hasAccount
      ? {
          'bankName': '국민은행',
          'maskedAccountNumber': '••••1024',
          'verified': verified,
          'verificationFailureReason': verified ? null : '예금주 이름이 가입자 이름과 달라요.',
        }
      : null,
  'onHold': !hasAccount || !verified,
  'current': settlementWeekJson(
    weekStart: '2026-10-12',
    weekEnd: '2026-10-18',
    payoutDate: '2026-10-20',
    status: 'IN_PROGRESS',
    trips: 3,
    gross: 84000,
    extraFare: 0,
  ),
  'upcoming':
      upcoming ??
      [
        settlementWeekJson(
          status: verified && hasAccount ? 'WAITING' : 'HOLD',
          reason: verified && hasAccount ? null : '예금주 이름이 가입자 이름과 달라요.',
        ),
      ],
  'paid':
      paid ??
      [
        settlementWeekJson(
          weekStart: '2026-09-28',
          weekEnd: '2026-10-04',
          payoutDate: '2026-10-06',
          status: 'PAID',
          trips: 24,
          gross: 688000,
          extraFare: 32000,
          paidAt: '2026-10-06T01:12:00.000Z',
        ),
      ],
};

const assignedDriver = {
  'id': 'driver-1',
  'name': '김도윤',
  'phone': '01098765432',
  'vehicleType': 'DAMAS',
  'vehicleNumber': '서울81바2047',
  'rating': 4.9,
  'reviewCount': 128,
};

/// 주문 상세 (기사와 평가가 붙는다).
Json orderDetailJson({
  String status = 'ASSIGNED',
  Json? driver = assignedDriver,
  Json? review,
  Json? payment,
  Json Function(Json order)? edit,
}) {
  final order = orderJson(status: status);
  final open = const ['REQUESTED', 'PAYING', 'PAYMENT_FAILED'].contains(status);
  return {
    ...edit?.call(order) ?? order,
    'driver': open ? null : driver,
    'review': review,
    'payment': ?payment,
  };
}

Json trackingJson({String status = 'PICKED_UP'}) => {
  'status': status,
  'driverLocation': {
    'latitude': 37.5215,
    'longitude': 127.0465,
    'updatedAt': isoAt(const Duration(seconds: -5)),
  },
  'estimatedPickupAt': isoAt(const Duration(minutes: -3)),
  'estimatedDeliveryAt': isoAt(const Duration(minutes: 18)),
};

Json estimatesJson() => {
  'distanceKm': 8.2,
  'durationMinutes': 32,
  'route': [
    {'latitude': 37.5445, 'longitude': 127.0557},
    {'latitude': 37.5445, 'longitude': 127.0440},
    {'latitude': 37.5000, 'longitude': 127.0410},
    {'latitude': 37.5000, 'longitude': 127.0364},
  ],
  'options': [
    _option('MOTORCYCLE', '오토바이', 'QUICK', '서류 · 소형 박스', 20, 12000),
    _option('DAMAS', '다마스', 'QUICK', '박스 10개', 400, 28000),
    _option('LABO', '라보', 'QUICK', '소형 가구', 500, 36000),
    _option('TRUCK_1T', '1톤 트럭', 'FREIGHT', '가구 · 가전', 1000, 74000),
    _option('TRUCK_2_5T', '2.5톤 트럭', 'FREIGHT', '이삿짐 · 대형 화물', 2500, 120000),
    _option('TRUCK_5T', '5톤 트럭', 'FREIGHT', '대형 이사 · 대량 화물', 5000, 190000),
  ],
};

Json _option(
  String type,
  String label,
  String service,
  String hint,
  int maxLoadKg,
  int fare,
) => {
  'vehicleType': type,
  'label': label,
  'serviceType': service,
  'capacityHint': hint,
  'maxLoadKg': maxLoadKg,
  'fare': fare,
};

List<Json> vehicleTypesJson() => [
  for (final option in estimatesJson()['options'] as List<dynamic>)
    {
      'type': (option as Json)['vehicleType'],
      'label': option['label'],
      'serviceType': option['serviceType'],
      'capacityHint': option['capacityHint'],
      'maxLoadKg': option['maxLoadKg'],
    },
];

Json pageJson(List<Object?> items, {int? total}) => {
  'items': items,
  'total': total ?? items.length,
  'page': 1,
  'size': 20,
};

Json savedAddressJson(
  String id,
  String label,
  String address, {
  String? sigungu,
  String? dong,
  double latitude = 37.5,
  double longitude = 127.0364,
}) => {
  'id': id,
  'label': label,
  'address': address,
  'detailAddress': null,
  'sigungu': sigungu,
  'dong': dong,
  'latitude': latitude,
  'longitude': longitude,
  'createdAt': '2026-10-01T00:12:00.000Z',
};

Json myDriverJson({
  String status = 'APPROVED',
  bool available = false,
  String vehicleType = 'DAMAS',
  String? rejectionReason,
  Duration? onlineFor,
  Duration todayOnline = const Duration(hours: 6, minutes: 20),
}) => {
  'id': 'driver-1',
  'userId': 'user-2',
  'vehicleType': vehicleType,
  'vehicleNumber': '서울81바2047',
  'status': status,
  'available': available,
  'rejectionReason': rejectionReason,
  'approvedAt': status == 'APPROVED' ? '2026-10-13T01:00:00.000Z' : null,
  'createdAt': '2026-10-13T00:12:00.000Z',
  'onlineSince': onlineFor == null ? null : isoAt(-onlineFor),
  'todayOnlineSeconds': todayOnline.inSeconds,
};

List<Json> documentsJson([
  List<String> statuses = const ['APPROVED', 'APPROVED', 'APPROVED'],
  String? rejectionReason,
]) => [
  for (final (index, type) in const [
    'DRIVER_LICENSE',
    'VEHICLE_REGISTRATION',
    'FREIGHT_QUALIFICATION',
  ].indexed)
    {
      'type': type,
      'status': statuses[index],
      'rejectionReason': statuses[index] == 'REJECTED' ? rejectionReason : null,
      'uploadedAt': statuses[index] == 'NOT_SUBMITTED'
          ? null
          : '2026-10-13T00:12:00.000Z',
    },
];

Json openOrderJson({
  String id = 'order-1',
  String pickupArea = '성동구 성수동2가',
  String dropoffArea = '강남구 역삼동',
  double distanceKm = 8.2,
  int durationMinutes = 32,
  int fare = 28000,
  String loadingHelp = 'NONE',
  int helpFee = 0,
  Json dropoffAccess = const {'floor': 1, 'elevator': true},
  int stairFee = 0,
  Json cargo = boxes,
  Duration requestedAgo = const Duration(seconds: 20),
  String? scheduledPickupAt,
  double? distanceFromMeKm = 2.1,
}) => {
  'id': id,
  'serviceType': 'QUICK',
  'vehicleType': 'DAMAS',
  'pickupArea': pickupArea,
  'pickupLatitude': 37.54,
  'pickupLongitude': 127.06,
  'dropoffArea': dropoffArea,
  'dropoffLatitude': 37.5,
  'dropoffLongitude': 127.04,
  'cargo': cargo,
  'distanceKm': distanceKm,
  'durationMinutes': durationMinutes,
  'baseFare': fare - helpFee - stairFee,
  'loadingHelp': loadingHelp,
  'helpFee': helpFee,
  'pickupAccess': const {'floor': 1, 'elevator': true},
  'dropoffAccess': dropoffAccess,
  'stairFee': stairFee,
  'fare': fare,
  'scheduledPickupAt': scheduledPickupAt,
  'requestedAt': isoAt(-requestedAgo),
  'distanceFromMeKm': distanceFromMeKm,
};

Json navigationJson({bool toDropoff = false}) => {
  'target': toDropoff ? 'DROPOFF' : 'PICKUP',
  'address': toDropoff ? yeoksam['address'] : seongsu['address'],
  'latitude': toDropoff ? 37.5 : 37.5445,
  'longitude': toDropoff ? 127.0364 : 127.0557,
  'distanceKm': toDropoff ? 6.1 : 2.1,
  'durationMinutes': toDropoff ? 25 : 7,
  'route': toDropoff
      ? [
          {'latitude': 37.5215, 'longitude': 127.0465},
          {'latitude': 37.5000, 'longitude': 127.0440},
          {'latitude': 37.5000, 'longitude': 127.0364},
        ]
      : [
          {'latitude': 37.5560, 'longitude': 127.0300},
          {'latitude': 37.5560, 'longitude': 127.0550},
          {'latitude': 37.5445, 'longitude': 127.0557},
        ],
};

/// 한국 날짜 (YYYY-MM-DD). [daysAgo]일 전.
String kstDay(int daysAgo) => DateTime.now()
    .toUtc()
    .add(const Duration(hours: 9))
    .subtract(Duration(days: daysAgo))
    .toIso8601String()
    .substring(0, 10);

/// 기사 수입. [amounts]는 오래된 날부터 오늘까지의 하루 수입이다.
Json earningsJson({
  List<int> amounts = const [86000, 104000, 131000, 58000, 0, 151000, 112000],
  int completedCount = 23,
  int cancelledCount = 1,
  int nextSettlement = 642000,
}) => {
  'from': kstDay(amounts.length - 1),
  'to': kstDay(0),
  'totalEarnings': amounts.fold(0, (sum, amount) => sum + amount),
  'totalSales': amounts.fold(0, (sum, amount) => sum + amount),
  'completedCount': completedCount,
  'cancelledCount': cancelledCount,
  'noShowCount': 0,
  'daily': [
    for (final (index, amount) in amounts.indexed)
      {
        'date': kstDay(amounts.length - 1 - index),
        'earnings': amount,
        'sales': amount,
        'completedCount': amount == 0 ? 0 : (amount / 28000).ceil(),
      },
  ],
  'nextSettlement': {'date': kstDay(-3), 'amount': nextSettlement},
};

/// 주소 검색 결과 한 곳 (`GET /address-search`의 항목).
Json foundAddressJson(
  String address, {
  String? detail,
  String? sigungu,
  String? dong,
  double latitude = 37.5,
  double longitude = 127.0364,
}) => {
  'address': address,
  'detail': detail,
  'sigungu': sigungu,
  'dong': dong,
  'latitude': latitude,
  'longitude': longitude,
};

/// 가짜 서버의 주소 검색이 찾는 견본 주소. 서버의 견본(SampleAddressSearch)과 같다.
final sampleAddresses = [
  foundAddressJson(
    '서울 성동구 성수이로 113',
    sigungu: '성동구',
    dong: '성수동2가',
    latitude: 37.5445,
    longitude: 127.0557,
  ),
  foundAddressJson(
    '서울 강남구 테헤란로 152',
    detail: '강남파이낸스센터',
    sigungu: '강남구',
    dong: '역삼동',
    latitude: 37.5,
    longitude: 127.0364,
  ),
  foundAddressJson(
    '서울 강남구 테헤란로 151',
    sigungu: '강남구',
    dong: '역삼동',
    latitude: 37.4995,
    longitude: 127.0359,
  ),
  foundAddressJson(
    '서울 강남구 테헤란로15길 4',
    sigungu: '강남구',
    dong: '역삼동',
    latitude: 37.5003,
    longitude: 127.0338,
  ),
  foundAddressJson(
    '서울 마포구 양화로 45',
    detail: '메세나폴리스',
    sigungu: '마포구',
    dong: '서교동',
    latitude: 37.5502,
    longitude: 126.9138,
  ),
  foundAddressJson(
    '서울 마포구 월드컵북로 396',
    detail: '누리꿈스퀘어',
    sigungu: '마포구',
    dong: '상암동',
    latitude: 37.5796,
    longitude: 126.89,
  ),
  foundAddressJson(
    '서울 영등포구 여의대로 108',
    detail: '파크원',
    sigungu: '영등포구',
    dong: '여의도동',
    latitude: 37.5265,
    longitude: 126.9285,
  ),
  foundAddressJson(
    '서울 송파구 올림픽로 300',
    detail: '롯데월드타워',
    sigungu: '송파구',
    dong: '신천동',
    latitude: 37.5126,
    longitude: 127.1025,
  ),
  foundAddressJson(
    '서울 중구 세종대로 110',
    detail: '서울시청',
    sigungu: '중구',
    dong: '태평로1가',
    latitude: 37.5663,
    longitude: 126.9779,
  ),
  foundAddressJson(
    '경기 성남시 분당구 판교역로 166',
    sigungu: '성남시 분당구',
    dong: '백현동',
    latitude: 37.3948,
    longitude: 127.1112,
  ),
  foundAddressJson(
    '경기 고양시 일산동구 정발산로 24',
    detail: '웨스턴돔',
    sigungu: '고양시 일산동구',
    dong: '장항동',
    latitude: 37.6557,
    longitude: 126.7708,
  ),
];

/// 검색어의 낱말이 모두 들어 있는 견본 주소. 띄어쓰기는 무시한다.
List<Json> searchSampleAddresses(String query) {
  final words = query.trim().split(RegExp(r'\s+')).where((w) => w.isNotEmpty);
  if (words.isEmpty) return const [];
  return [
    for (final place in sampleAddresses)
      if (words.every(
        '${place['address']} ${place['detail'] ?? ''} ${place['dong'] ?? ''}'
            .replaceAll(' ', '')
            .contains,
      ))
        place,
  ];
}
