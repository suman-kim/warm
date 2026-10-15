import 'package:movo_api/movo_api.dart';

import '../design/icons.dart';

// 화면에 보여줄 글자를 만드는 함수들. 시각은 기기의 시간대로 보여준다.

String _two(int n) => n.toString().padLeft(2, '0');

/// 28000 → 28,000원
String won(int amount) {
  final digits = amount.abs().toString();
  final buffer = StringBuffer(amount < 0 ? '-' : '');
  for (var i = 0; i < digits.length; i++) {
    if (i > 0 && (digits.length - i) % 3 == 0) buffer.write(',');
    buffer.write(digits[i]);
  }
  return '$buffer원';
}

/// 112000 → 11.2만 (그래프 위의 짧은 금액)
String shortWon(int amount) {
  if (amount < 10000) return won(amount);
  final man = amount / 10000;
  return '${man == man.roundToDouble() ? man.toInt() : man.toStringAsFixed(1)}만';
}

/// 8.2 → 8.2km
String km(double distance) => '${distance.toStringAsFixed(1)}km';

/// 15.0 → 15kg, 400.5 → 400.5kg
String kg(double weight) =>
    '${weight == weight.roundToDouble() ? weight.toInt() : weight}kg';

/// 14:02
String clock(DateTime at) {
  final local = at.toLocal();
  return '${_two(local.hour)}:${_two(local.minute)}';
}

/// 10월 13일
String monthDay(DateTime at) {
  final local = at.toLocal();
  return '${local.month}월 ${local.day}일';
}

/// 10월 13일 09:12
String monthDayClock(DateTime at) => '${monthDay(at)} ${clock(at)}';

/// 오늘 14:04 / 어제 21:10 / 10월 6일 14:22
String dayClock(DateTime at, {DateTime? now}) {
  final today = now ?? DateTime.now();
  if (sameDay(at, today)) return '오늘 ${clock(at)}';
  if (sameDay(at, today.subtract(const Duration(days: 1)))) {
    return '어제 ${clock(at)}';
  }
  return monthDayClock(at);
}

/// 경과 시간 12:25 (분:초). 한 시간이 넘으면 1:02:25.
String stopwatch(Duration passed) {
  final seconds = passed.isNegative ? 0 : passed.inSeconds;
  final hours = seconds ~/ 3600;
  final rest = '${_two(seconds % 3600 ~/ 60)}:${_two(seconds % 60)}';
  return hours > 0 ? '$hours:$rest' : rest;
}

const weekdays = ['월', '화', '수', '목', '금', '토', '일'];

/// 수
String weekday(DateTime at) => weekdays[at.toLocal().weekday - 1];

bool sameDay(DateTime a, DateTime b) {
  final x = a.toLocal(), y = b.toLocal();
  return x.year == y.year && x.month == y.month && x.day == y.day;
}

/// 오늘 · 10월 13일 / 어제 · 10월 12일 / 10월 9일
String dayHeading(DateTime at, {DateTime? now}) {
  final today = now ?? DateTime.now();
  if (sameDay(at, today)) return '오늘 · ${monthDay(at)}';
  if (sameDay(at, today.subtract(const Duration(days: 1)))) {
    return '어제 · ${monthDay(at)}';
  }
  return monthDay(at);
}

/// 37분 / 6시간 20분
String duration(Duration value) {
  final minutes = value.inMinutes;
  if (minutes < 60) return '$minutes분';
  final rest = minutes % 60;
  return rest == 0 ? '${minutes ~/ 60}시간' : '${minutes ~/ 60}시간 $rest분';
}

/// 지금부터 그 시각까지 남은 분 (지났으면 0).
int minutesUntil(DateTime at, {DateTime? now}) {
  final left = at.difference(now ?? DateTime.now());
  return left.isNegative ? 0 : (left.inSeconds / 60).ceil();
}

/// 방금 / 3분 전 / 2시간 전 / 10월 9일
String timeAgo(DateTime at, {DateTime? now}) {
  final passed = (now ?? DateTime.now()).difference(at);
  if (passed.inMinutes < 1) return '방금';
  if (passed.inMinutes < 60) return '${passed.inMinutes}분 전';
  if (passed.inHours < 24) return '${passed.inHours}시간 전';
  return monthDay(at);
}

/// 01012345678 → 010-1234-5678
String phone(String digits) {
  final d = digits.replaceAll(RegExp(r'\D'), '');
  if (d.startsWith('02') && d.length >= 9) {
    return '02-${d.substring(2, d.length - 4)}-${d.substring(d.length - 4)}';
  }
  if (d.length >= 10) {
    return '${d.substring(0, 3)}-${d.substring(3, d.length - 4)}-${d.substring(d.length - 4)}';
  }
  return digits;
}

/// 차량 번호를 읽기 좋게 띄운다: 서울81바2047 → 서울 81바 2047
String plate(String number) {
  final match = RegExp(
    r'^([가-힣]{2})?(\d{2,3})([가-힣])(\d{4})$',
  ).firstMatch(number.replaceAll(' ', ''));
  if (match == null) return number;
  return [
    ?match.group(1),
    '${match.group(2)}${match.group(3)}',
    match.group(4),
  ].join(' ');
}

String vehicleLabel(VehicleType type) => switch (type) {
  VehicleType.motorcycle => '오토바이',
  VehicleType.damas => '다마스',
  VehicleType.labo => '라보',
  VehicleType.truck1Ton => '1톤 트럭',
  VehicleType.truck2HalfTon => '2.5톤 트럭',
  VehicleType.truck5Ton => '5톤 트럭',
  VehicleType.unknown => '차량',
};

MovoIcons vehicleIcon(VehicleType type) => switch (type) {
  VehicleType.motorcycle => MovoIcons.motorcycle,
  VehicleType.damas => MovoIcons.vanWindow,
  _ => MovoIcons.truck,
};

String serviceLabel(ServiceType type) => switch (type) {
  ServiceType.quick => '퀵 배송',
  ServiceType.freight => '화물 운송',
  ServiceType.unknown => '배송',
};

String cargoLabel(CargoCategory category) => switch (category) {
  CargoCategory.document => '서류',
  CargoCategory.box => '박스',
  CargoCategory.shoppingBag => '쇼핑백',
  CargoCategory.furnitureAppliance => '가구·가전',
  CargoCategory.etc || CargoCategory.unknown => '기타',
};

/// 박스 3개
String cargoSummary(Cargo cargo) =>
    '${cargoLabel(cargo.category)} ${cargo.quantity}개';

/// 박스 3개 · 약 15kg
String cargoWithWeight(Cargo cargo) =>
    '${cargoSummary(cargo)} · 약 ${kg(cargo.weightKg)}';

String documentLabel(DriverDocumentType type) => switch (type) {
  DriverDocumentType.driverLicense => '운전면허증',
  DriverDocumentType.vehicleRegistration => '자동차등록증',
  DriverDocumentType.freightQualification => '화물운송 종사 자격증',
  DriverDocumentType.unknown => '서류',
};

String legalLabel(LegalDocumentType type) => switch (type) {
  LegalDocumentType.terms => '서비스 이용약관',
  LegalDocumentType.privacy => '개인정보 처리방침',
  LegalDocumentType.location => '위치기반서비스 이용약관',
  LegalDocumentType.refund => '취소·환불 규정',
  LegalDocumentType.driver => '기사 운송 약관',
  LegalDocumentType.marketing => '마케팅 정보 수신 동의',
  LegalDocumentType.unknown => '약관',
};

/// 주소에서 시·도를 뗀 짧은 표기: 서울 성동구 성수이로 113 → 성동구 성수이로 113
String shortAddress(String address) {
  final parts = address.trim().split(RegExp(r'\s+'));
  const provinces = {
    '서울',
    '서울특별시',
    '부산',
    '부산광역시',
    '대구',
    '대구광역시',
    '인천',
    '인천광역시',
    '광주',
    '광주광역시',
    '대전',
    '대전광역시',
    '울산',
    '울산광역시',
    '세종',
    '세종특별자치시',
    '경기',
    '경기도',
    '강원',
    '강원도',
    '강원특별자치도',
    '충북',
    '충청북도',
    '충남',
    '충청남도',
    '전북',
    '전라북도',
    '전북특별자치도',
    '전남',
    '전라남도',
    '경북',
    '경상북도',
    '경남',
    '경상남도',
    '제주',
    '제주도',
    '제주특별자치도',
  };
  if (parts.length > 2 && provinces.contains(parts.first)) {
    return parts.skip(1).join(' ');
  }
  return address;
}

/// 도로명과 번지만: 서울 성동구 성수이로 113 → 성수이로 113
String streetAddress(String address) {
  final parts = shortAddress(address).split(' ');
  // 앞의 '○○시 ○○구'를 뗀다.
  var start = 0;
  while (start < parts.length - 1 &&
      RegExp(r'(시|군|구)$').hasMatch(parts[start])) {
    start++;
  }
  return parts.skip(start).join(' ');
}

/// 경로 제목에 쓰는 지명: 동이 있으면 동, 없으면 구, 그것도 없으면 주소의 앞부분.
String placeName(Waypoint waypoint) =>
    // 성수동2가 → 성수동
    waypoint.dong?.replaceFirst(RegExp(r'\d+가$'), '') ??
    waypoint.sigungu ??
    shortAddress(waypoint.address).split(' ').first;

/// 성수동 → 역삼동
String routeTitle(Order order) =>
    '${placeName(order.pickup)} → ${placeName(order.dropoff)}';

/// 대기 콜의 지명: '성동구 성수동2가' → 성수동2가
String areaShort(String area) => area.split(' ').last;

/// 화면에 보여줄 오류 문구.
String errorMessage(Object error) => switch (error) {
  ApiException(code: ApiErrorCode.validationFailed) => '입력한 내용을 다시 확인해 주세요.',
  MovoException(:final message) => message,
  _ => '문제가 생겼어요. 잠시 후 다시 시도해 주세요.',
};
