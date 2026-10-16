import '../json.dart';
import 'enums.dart';

/// 알림함의 알림 한 건.
class AppNotification {
  const AppNotification({
    required this.id,
    required this.type,
    required this.title,
    required this.body,
    required this.data,
    required this.readAt,
    required this.createdAt,
  });

  factory AppNotification.fromJson(Json json) => AppNotification(
    id: json['id'] as String,
    type: NotificationType.parse(json['type'] as String),
    title: json['title'] as String,
    body: json['body'] as String,
    data: {
      for (final MapEntry(:key, :value) in (json['data'] as Json).entries)
        key: '$value',
    },
    readAt: parseDateOrNull(json['readAt']),
    createdAt: parseDate(json['createdAt']),
  );

  final String id;
  final NotificationType type;
  final String title;
  final String body;

  /// 눌렀을 때 갈 곳을 정하는 값. 푸시의 `data`와 같다.
  final Map<String, String> data;

  /// 읽은 시각. 아직 안 읽었으면 null.
  final DateTime? readAt;
  final DateTime createdAt;

  bool get isRead => readAt != null;

  /// 주문에 관한 알림이면 그 주문의 ID.
  String? get orderId => data['orderId'];
}

/// 알림함 한 페이지.
class NotificationInbox {
  const NotificationInbox({
    required this.items,
    required this.total,
    required this.page,
    required this.size,
    required this.unreadCount,
  });

  factory NotificationInbox.fromJson(Json json) => NotificationInbox(
    items: [
      for (final item in json['items'] as List<dynamic>)
        AppNotification.fromJson(item as Json),
    ],
    total: (json['total'] as num).toInt(),
    page: (json['page'] as num).toInt(),
    size: (json['size'] as num).toInt(),
    unreadCount: (json['unreadCount'] as num).toInt(),
  );

  /// 최근 것부터
  final List<AppNotification> items;
  final int total;
  final int page;
  final int size;

  /// 안 읽은 알림 수 (페이지와 무관한 전체)
  final int unreadCount;

  bool get hasMore => page * size < total;
}

/// 공지 목록의 한 줄. 본문은 `notices.get`으로 받는다.
class NoticeSummary {
  const NoticeSummary({
    required this.id,
    required this.title,
    required this.audience,
    required this.publishedAt,
  });

  factory NoticeSummary.fromJson(Json json) => NoticeSummary(
    id: json['id'] as String,
    title: json['title'] as String,
    audience: NoticeAudience.parse(json['audience'] as String),
    publishedAt: parseDate(json['publishedAt']),
  );

  final String id;
  final String title;
  final NoticeAudience audience;
  final DateTime publishedAt;
}

/// 공지사항.
class Notice extends NoticeSummary {
  const Notice({
    required super.id,
    required super.title,
    required super.audience,
    required super.publishedAt,
    required this.body,
  });

  factory Notice.fromJson(Json json) {
    final summary = NoticeSummary.fromJson(json);
    return Notice(
      id: summary.id,
      title: summary.title,
      audience: summary.audience,
      publishedAt: summary.publishedAt,
      body: json['body'] as String,
    );
  }

  final String body;
}

/// 약관·정책 목록의 한 줄. 본문은 `legal.document`로 받는다.
class LegalDocumentSummary {
  const LegalDocumentSummary({
    required this.type,
    required this.version,
    required this.title,
    required this.effectiveAt,
  });

  factory LegalDocumentSummary.fromJson(Json json) => LegalDocumentSummary(
    type: LegalDocumentType.parse(json['type'] as String),
    version: json['version'] as String,
    title: json['title'] as String,
    effectiveAt: parseDate(json['effectiveAt']),
  );

  final LegalDocumentType type;

  /// 판 번호 (예: 1.0)
  final String version;
  final String title;

  /// 시행일
  final DateTime effectiveAt;
}

/// 약관·정책 (지금 시행 중인 판).
class LegalDocument extends LegalDocumentSummary {
  const LegalDocument({
    required super.type,
    required super.version,
    required super.title,
    required super.effectiveAt,
    required this.body,
  });

  factory LegalDocument.fromJson(Json json) {
    final summary = LegalDocumentSummary.fromJson(json);
    return LegalDocument(
      type: summary.type,
      version: summary.version,
      title: summary.title,
      effectiveAt: summary.effectiveAt,
      body: json['body'] as String,
    );
  }

  final String body;
}

/// 고객센터 연락처. 서버에 설정하지 않은 항목은 null — 화면에서 그 항목을 숨긴다.
class SupportContact {
  const SupportContact({
    required this.phone,
    required this.email,
    required this.hours,
    required this.kakaoChannelUrl,
  });

  factory SupportContact.fromJson(Json json) => SupportContact(
    phone: json['phone'] as String?,
    email: json['email'] as String?,
    hours: json['hours'] as String?,
    kakaoChannelUrl: json['kakaoChannelUrl'] as String?,
  );

  /// 전화번호 (예: 1588-0000)
  final String? phone;
  final String? email;

  /// 운영 시간 안내 (예: 평일 09:00~18:00)
  final String? hours;

  /// 카카오톡 채널 주소
  final String? kakaoChannelUrl;
}

/// 주소 검색으로 찾은 한 곳. 고르면 가게 주소나 손님 주소가 된다.
class FoundAddress {
  const FoundAddress({
    required this.address,
    required this.detail,
    required this.sigungu,
    required this.dong,
    required this.latitude,
    required this.longitude,
  });

  factory FoundAddress.fromJson(Json json) => FoundAddress(
    address: json['address'] as String,
    detail: json['detail'] as String?,
    sigungu: json['sigungu'] as String?,
    dong: json['dong'] as String?,
    latitude: (json['latitude'] as num).toDouble(),
    longitude: (json['longitude'] as num).toDouble(),
  );

  /// 도로명 주소 (없으면 지번 주소). 예: 서울 강남구 테헤란로 152
  final String address;

  /// 건물이나 장소 이름. 예: 강남파이낸스센터
  final String? detail;

  /// 시·군·구와 법정동 — 그대로 서버에 보낸다. 수락 전 라이더에게는 구·동까지만 보인다.
  final String? sigungu;
  final String? dong;
  final double latitude;
  final double longitude;
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
