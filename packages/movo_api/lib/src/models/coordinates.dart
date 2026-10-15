import '../json.dart';

/// 위경도 좌표 (WGS84).
class Coordinates {
  const Coordinates({required this.latitude, required this.longitude});

  factory Coordinates.fromJson(Json json) => Coordinates(
    latitude: (json['latitude'] as num).toDouble(),
    longitude: (json['longitude'] as num).toDouble(),
  );

  final double latitude;
  final double longitude;

  Json toJson() => {'latitude': latitude, 'longitude': longitude};

  @override
  bool operator ==(Object other) =>
      other is Coordinates &&
      other.latitude == latitude &&
      other.longitude == longitude;

  @override
  int get hashCode => Object.hash(latitude, longitude);

  @override
  String toString() => '($latitude, $longitude)';
}
