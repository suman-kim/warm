import '../json.dart';
import 'enums.dart';

/// 회원.
class User {
  const User({
    required this.id,
    required this.email,
    required this.name,
    required this.phone,
    required this.role,
    required this.marketingAgreed,
    required this.createdAt,
  });

  factory User.fromJson(Json json) => User(
    id: json['id'] as String,
    email: json['email'] as String,
    name: json['name'] as String,
    phone: json['phone'] as String,
    role: UserRole.parse(json['role'] as String),
    marketingAgreed: json['marketingAgreed'] as bool,
    createdAt: parseDate(json['createdAt']),
  );

  final String id;
  final String email;
  final String name;

  /// 숫자만 (예: 01012345678)
  final String phone;
  final UserRole role;

  /// 마케팅 정보 수신에 동의했는지
  final bool marketingAgreed;
  final DateTime createdAt;
}
