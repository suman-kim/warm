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

/// 라이더의 한 주 정산.
Json settlementWeekJson({
  String weekStart = '2026-10-05',
  String weekEnd = '2026-10-11',
  String payoutDate = '2026-10-14',
  String status = 'WAITING',
  String? reason,
  int trips = 21,
  int gross = 612000,
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
    'fee': fee,
    'compensation': compensation,
    'net': gross - fee + compensation,
    'paidAt': paidAt,
    'bankName': '국민은행',
    'maskedAccountNumber': '••••1024',
  };
}

/// 라이더의 정산 내역.
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
          paidAt: '2026-10-06T01:12:00.000Z',
        ),
      ],
};

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

Json pageJson(List<Object?> items, {int? total}) => {
  'items': items,
  'total': total ?? items.length,
  'page': 1,
  'size': 20,
};

Json myDriverJson({
  String status = 'APPROVED',
  bool available = false,
  String vehicleType = 'MOTORCYCLE',
  String? rejectionReason,
  Duration? onlineFor,
  Duration todayOnline = const Duration(hours: 6, minutes: 20),
}) => {
  'id': 'driver-1',
  'userId': 'user-2',
  'vehicleType': vehicleType,
  'vehicleNumber': '서울강남가1234',
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
    'DELIVERY_INSURANCE',
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

/// 한국 날짜 (YYYY-MM-DD). [daysAgo]일 전.
String kstDay(int daysAgo) => DateTime.now()
    .toUtc()
    .add(const Duration(hours: 9))
    .subtract(Duration(days: daysAgo))
    .toIso8601String()
    .substring(0, 10);

/// 라이더 수입. [amounts]는 오래된 날부터 오늘까지의 하루 수입이다.
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

/// 가게 주소 (모보치킨 역삼점) — 모든 배달의 픽업지.
const storeAddressJson = {
  'address': '서울 강남구 테헤란로 152',
  'detailAddress': '1층',
  'sigungu': '강남구',
  'dong': '역삼동',
  'latitude': 37.5000,
  'longitude': 127.0364,
};

/// 사장님의 가게.
Json storeJson({
  String status = 'APPROVED',
  int walletBalance = 84500,
  String? rejectionReason,
}) => {
  'id': 'store-1',
  'name': '모보치킨 역삼점',
  'businessNumber': '2208162517',
  'phone': '025551234',
  'address': storeAddressJson,
  'status': status,
  'rejectionReason': rejectionReason,
  'walletBalance': walletBalance,
  'appliedAt': isoAt(const Duration(days: -3)),
  'reviewedAt': status == 'PENDING' ? null : isoAt(const Duration(days: -2)),
};

/// 충전금 내역 한 줄.
Json walletEntryJson({
  String id = 'entry-1',
  String kind = 'DELIVERY_FEE',
  int amount = -3500,
  int balanceAfter = 84500,
  String? orderId,
  String? memo,
  Duration ago = const Duration(minutes: 5),
}) => {
  'id': id,
  'kind': kind,
  'amount': amount,
  'balanceAfter': balanceAfter,
  'orderId': orderId,
  'memo': memo,
  'createdAt': isoAt(-ago),
};

Json walletJson(List<Json> items, {int balance = 84500}) => {
  'balance': balance,
  'items': items,
  'total': items.length,
  'page': 1,
  'size': 50,
};

/// 손님 집 (역삼로 180).
const customerHomeJson = {
  'address': '서울 강남구 역삼로 180',
  'detailAddress': '101동 1203호',
  'sigungu': '강남구',
  'dong': '역삼동',
  'latitude': 37.4955,
  'longitude': 127.0495,
  'contactName': '손님',
  'contactPhone': '050412345678',
};

/// 가게 배달: 가게가 픽업지, 손님이 도착지, 대행료가 요금이다.
/// [status]에 맞는 시각이 채워진다 — 요청은 [requestedAgo] 전, 배차는 그 1분 뒤.
/// `CANCELLED_OPEN`은 배차 전에 취소한 배달이다.
Json deliveryJson({
  String id = '3f9a-delivery',
  String status = 'ASSIGNED',
  int fee = 3500,
  String doorPayment = 'PREPAID',
  int foodAmount = 0,
  String? collectedMethod,
  int? collectedAmount,
  String? driverName = '김라이더',
  int cancellationFee = 0,
  String? cancelReason,
  Json dropoff = customerHomeJson,
  Duration requestedAgo = const Duration(minutes: 9),
}) {
  final requested = -requestedAgo;
  final open = const ['REQUESTED', 'CANCELLED_OPEN'].contains(status);
  final assigned = !open;
  final departed = const [
    'DEPARTED',
    'ARRIVED',
    'PICKED_UP',
    'DELIVERED',
  ].contains(status);
  final arrived = const ['ARRIVED', 'PICKED_UP', 'DELIVERED'].contains(status);
  final pickedUp = status == 'PICKED_UP' || status == 'DELIVERED';
  final delivered = status == 'DELIVERED';
  final cancelled = status.startsWith('CANCELLED');
  final finished = delivered || cancelled;
  return {
    'id': id,
    'code':
        'MV261015-${id.replaceAll('-', '').toUpperCase().padRight(4, '0').substring(0, 4)}',
    'customerId': 'user-1',
    'status': cancelled ? 'CANCELLED' : status,
    'storeDelivery': {
      'storeId': 'store-1',
      'foodAmount': foodAmount,
      'doorPayment': doorPayment,
      'readyAt': isoAt(requested + const Duration(minutes: 15)),
      'collectedMethod': collectedMethod,
      'collectedAmount': collectedAmount,
      'cashHandedAt': null,
    },
    'pickup': {
      ...storeAddressJson,
      'contactName': '모보치킨 역삼점',
      'contactPhone': '025551234',
    },
    'dropoff': dropoff,
    'memo': '문 앞에 두고 벨 눌러 주세요',
    'distanceKm': 1.3,
    'durationMinutes': 7,
    'fare': fee,
    'cancellationFee': cancellationFee,
    // 취소 수수료는 대행료의 15%를 원 단위로 (3,500원 → 525원).
    'cancellationFeeNow': switch (status) {
      'REQUESTED' || 'ASSIGNED' => 0,
      'DEPARTED' || 'ARRIVED' => (fee * 15 / 100).round(),
      _ => null,
    },
    'driverId': assigned ? 'driver-1' : null,
    // 라이더 이름. 가게의 배달 목록에만 온다.
    'driverName': ?(assigned ? driverName : null),
    'estimatedPickupAt': assigned && !cancelled
        ? isoAt(requested + const Duration(minutes: 16))
        : null,
    'estimatedDeliveryAt': assigned && !finished
        ? isoAt(requested + const Duration(minutes: 23))
        : null,
    'requestedAt': isoAt(requested),
    'assignedAt': assigned
        ? isoAt(requested + const Duration(minutes: 1))
        : null,
    'departedAt': departed
        ? isoAt(requested + const Duration(minutes: 1, seconds: 30))
        : null,
    'arrivedAt': arrived ? isoAt(requested + const Duration(minutes: 2)) : null,
    'pickedUpAt': pickedUp
        ? isoAt(requested + const Duration(minutes: 3))
        : null,
    'deliveredAt': delivered
        ? isoAt(requested + const Duration(minutes: 8))
        : null,
    'cancelledAt': cancelled
        ? isoAt(requested + const Duration(minutes: 2))
        : null,
    'cancelReason': cancelReason,
  };
}

/// 배달을 맡은 라이더.
const riderJson = {
  'id': 'driver-1',
  'name': '김라이더',
  'phone': '01048211024',
  'vehicleType': 'MOTORCYCLE',
  'vehicleNumber': '서울강남가1234',
};

/// 가게 배달 상세 (라이더가 붙는다).
Json deliveryDetailJson(Json delivery, {Json? driver = riderJson}) => {
  ...delivery,
  'driver': delivery['driverId'] == null ? null : driver,
};

Json deliveryQuoteJson({int fee = 3500, int walletBalance = 84500}) => {
  'distanceKm': 1.3,
  'durationMinutes': 7,
  'fee': fee,
  'walletBalance': walletBalance,
};

/// 라이더가 보는 가게 배달 콜.
Json callJson({
  String id = 'call-1',
  String storeName = '모보치킨 역삼점',
  String dropoffArea = '강남구 역삼동',
  int fee = 3500,
  String doorPayment = 'CASH',
  int foodAmount = 23000,
  Duration readyIn = const Duration(minutes: 15),
  Duration requestedAgo = const Duration(minutes: 1),
  double? distanceFromMeKm = 2.1,
}) => {
  'id': id,
  'storeDelivery': {
    'storeName': storeName,
    'foodAmount': foodAmount,
    'doorPayment': doorPayment,
    'readyAt': isoAt(readyIn),
  },
  'pickupArea': '강남구 역삼동',
  'pickupLatitude': 37.5,
  'pickupLongitude': 127.04,
  'dropoffArea': dropoffArea,
  'dropoffLatitude': 37.5,
  'dropoffLongitude': 127.05,
  'distanceKm': 1.3,
  'durationMinutes': 7,
  'fare': fee,
  // 수수료 10%를 10원 단위로 반올림해 뺀 라이더 몫
  'earning': fee - (fee / 100).round() * 10,
  'requestedAt': isoAt(-requestedAgo),
  'distanceFromMeKm': distanceFromMeKm,
};

/// 라이더가 맡은 가게 배달 (라이더 몫이 붙는다).
Json riderDeliveryJson({
  String id = '3f9a-delivery',
  String status = 'ASSIGNED',
  int fee = 3500,
  String doorPayment = 'CASH',
  int foodAmount = 23000,
  String? collectedMethod,
  int? collectedAmount,
  String? storeId,
  Json dropoff = customerHomeJson,
  String? cancelReason,
  Duration requestedAgo = const Duration(minutes: 9),
}) {
  final delivery = deliveryJson(
    id: id,
    status: status,
    fee: fee,
    doorPayment: doorPayment,
    foodAmount: foodAmount,
    collectedMethod: collectedMethod,
    collectedAmount: collectedAmount,
    cancelReason: cancelReason,
    dropoff: dropoff,
    requestedAgo: requestedAgo,
  );
  return {
    ...delivery,
    'earning': status.startsWith('CANCELLED')
        ? 0
        : fee - (fee / 100).round() * 10,
    if (storeId != null)
      'storeDelivery': {
        ...delivery['storeDelivery'] as Json,
        'storeId': storeId,
      },
  };
}
