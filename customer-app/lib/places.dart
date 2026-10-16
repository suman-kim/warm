import 'dart:math' as math;

import 'package:movo_api/movo_api.dart';

/// 주소 검색으로 고른 한 곳.
class Place {
  const Place({
    required this.address,
    this.detail,
    this.sigungu,
    this.dong,
    required this.latitude,
    required this.longitude,
  });

  /// 주소 검색(서버가 카카오 로컬 API로 찾는다)으로 고른 곳.
  factory Place.fromFound(FoundAddress found) => Place(
    address: found.address,
    detail: found.detail,
    sigungu: found.sigungu,
    dong: found.dong,
    latitude: found.latitude,
    longitude: found.longitude,
  );

  factory Place.fromWaypoint(Waypoint waypoint) => Place(
    address: waypoint.address,
    detail: waypoint.detailAddress,
    sigungu: waypoint.sigungu,
    dong: waypoint.dong,
    latitude: waypoint.latitude,
    longitude: waypoint.longitude,
  );

  /// 도로명 주소 (예: 서울 강남구 테헤란로 152)
  final String address;

  /// 건물 이름이나 동·호수
  final String? detail;

  /// 시·군·구. 서버에 함께 보낸다 — 수락 전 라이더에게는 구·동까지만 보인다.
  final String? sigungu;
  final String? dong;
  final double latitude;
  final double longitude;

  Coordinates get coordinates =>
      Coordinates(latitude: latitude, longitude: longitude);

  /// 두 곳 사이의 직선 거리(km).
  double distanceKmTo(Place other) {
    const radius = 6371.0;
    double rad(double degrees) => degrees * math.pi / 180;
    final dLat = rad(other.latitude - latitude);
    final dLng = rad(other.longitude - longitude);
    final a =
        math.pow(math.sin(dLat / 2), 2) +
        math.cos(rad(latitude)) *
            math.cos(rad(other.latitude)) *
            math.pow(math.sin(dLng / 2), 2);
    return 2 * radius * math.asin(math.sqrt(a));
  }
}
