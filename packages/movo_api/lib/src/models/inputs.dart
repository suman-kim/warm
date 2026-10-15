import 'dart:typed_data';

import '../json.dart';
import 'enums.dart';

/// 가입할 때 받는 약관 동의. 필수 항목에 동의하지 않으면 서버가 가입을 거절한다.
class Agreements {
  const Agreements({
    required this.terms,
    required this.privacy,
    this.marketing = false,
  });

  /// [필수] 이용약관
  final bool terms;

  /// [필수] 개인정보 수집·이용
  final bool privacy;

  /// [선택] 마케팅 정보 수신. 나중에 `users.update`로 바꿀 수 있다.
  final bool marketing;

  Json toJson() => {'terms': terms, 'privacy': privacy, 'marketing': marketing};
}

/// 배송을 요청할 때 보내는 픽업지·도착지.
///
/// 서버는 좌표를 받는다 — 주소를 좌표로 바꾸는 일(주소 검색)은 앱에서 한다.
class WaypointInput {
  const WaypointInput({
    required this.address,
    this.detailAddress,
    this.sigungu,
    this.dong,
    required this.latitude,
    required this.longitude,
    required this.contactName,
    required this.contactPhone,
  });

  /// 도로명 또는 지번 주소. 기사가 수락한 뒤에만 보인다.
  final String address;

  /// 동·호수 등. 기사가 수락한 뒤에만 보인다.
  final String? detailAddress;

  /// 시·군·구 (예: 성동구). 주소 검색 결과에서 받아 넣는다 — 수락 전 기사에게는
  /// 구·동까지만 보인다. 비우면 주소의 앞 두 마디(예: 서울 성동구)가 대신 보인다.
  final String? sigungu;

  /// 읍·면·동 (예: 성수동2가)
  final String? dong;
  final double latitude;
  final double longitude;

  /// 현장에서 화물을 주고받을 사람
  final String contactName;

  /// 하이픈이 있어도 된다. 기사가 수락한 뒤에만 보인다.
  final String contactPhone;

  Json toJson() => {
    'address': address,
    'detailAddress': ?detailAddress,
    'sigungu': ?sigungu,
    'dong': ?dong,
    'latitude': latitude,
    'longitude': longitude,
    'contactName': contactName,
    'contactPhone': contactPhone,
  };
}

/// 배송을 요청할 때 보내는 화물 정보.
class CargoInput {
  const CargoInput({
    required this.category,
    required this.weightKg,
    this.quantity,
    this.description,
  });

  final CargoCategory category;

  /// 전체 중량(kg). 차종의 최대 적재 중량을 넘으면 서버가 거절한다.
  final double weightKg;

  /// 수량. 안 보내면 1.
  final int? quantity;

  /// 종류만으로 부족할 때 덧붙이는 설명 (200자까지)
  final String? description;

  Json toJson() => {
    'category': category.wire,
    'weightKg': weightKg,
    'quantity': ?quantity,
    'description': ?description,
  };
}

/// 저장해 둘 주소.
class SavedAddressInput {
  const SavedAddressInput({
    required this.label,
    required this.address,
    this.detailAddress,
    this.sigungu,
    this.dong,
    required this.latitude,
    required this.longitude,
  });

  /// 주소에 붙일 이름 (예: 역삼 사무실, 30자까지)
  final String label;
  final String address;
  final String? detailAddress;
  final String? sigungu;
  final String? dong;
  final double latitude;
  final double longitude;

  Json toJson() => {
    'label': label,
    'address': address,
    'detailAddress': ?detailAddress,
    'sigungu': ?sigungu,
    'dong': ?dong,
    'latitude': latitude,
    'longitude': longitude,
  };
}

/// 서버에 올릴 파일 (기사 서류). 사진(JPG·PNG·WEBP·HEIC)이나 PDF, 10MB까지.
/// 형식은 서버가 파일 내용으로 판단한다.
class UploadFile {
  const UploadFile({required this.bytes, required this.filename});

  final Uint8List bytes;
  final String filename;
}

/// 서버에서 받은 파일.
class FileContent {
  const FileContent({required this.bytes, required this.contentType});

  final Uint8List bytes;

  /// 예: image/jpeg, application/pdf
  final String contentType;
}
