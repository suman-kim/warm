import '../api_exception.dart';
import '../api_transport.dart';
import '../json.dart';
import '../models/content.dart';
import '../models/enums.dart';
import '../models/paged.dart';
import '../models/user.dart';

// 가게 앱과 라이더 앱이 함께 쓰는 API.

String _segment(String value) => Uri.encodeComponent(value);

/// 회원.
class UsersApi {
  UsersApi(this._transport);

  final ApiTransport _transport;

  /// 내 정보.
  Future<User> me() async =>
      parseResponse(await _transport.send('GET', '/users/me'), User.fromJson);

  /// 내 정보 수정. 준 항목만 바뀐다. (탈퇴는 `auth.withdraw`.)
  Future<User> update({
    String? name,
    String? phone,
    bool? marketingAgreed,
  }) async => parseResponse(
    await _transport.send(
      'PATCH',
      '/users/me',
      body: {
        'name': ?name,
        'phone': ?phone,
        'marketingAgreed': ?marketingAgreed,
      },
    ),
    User.fromJson,
  );
}

/// 푸시 수신 기기.
class PushDevicesApi {
  PushDevicesApi(this._transport);

  final ApiTransport _transport;

  /// 이 기기를 내 푸시 수신 기기로 등록한다. 로그인 직후와 FCM 토큰이 바뀔 때마다 부른다.
  /// [token]은 FCM 토큰이다 (iOS도 APNs 토큰이 아니다).
  Future<void> register({
    required String token,
    required PushPlatform platform,
  }) => _transport.send(
    'PUT',
    '/push-devices',
    body: {'token': token, 'platform': platform.wire},
  );

  /// 이 기기의 푸시 수신을 해제한다. 로그아웃하기 전에 부른다.
  Future<void> unregister(String token) =>
      _transport.send('DELETE', '/push-devices/${_segment(token)}');
}

/// 알림함과 알림 설정.
class NotificationsApi {
  NotificationsApi(this._transport);

  final ApiTransport _transport;

  /// 받은 알림 (최근 것부터). 안 읽은 수가 함께 온다.
  ///
  /// 새 콜 알림은 푸시로만 오고 여기에는 쌓이지 않는다.
  Future<NotificationInbox> list({int page = 1, int size = 20}) async =>
      parseResponse(
        await _transport.send(
          'GET',
          '/notifications',
          query: {'page': page, 'size': size},
        ),
        NotificationInbox.fromJson,
      );

  /// 안 읽은 알림 수. 홈의 알림 배지에 쓴다.
  Future<int> unreadCount() async => parseResponse(
    await _transport.send('GET', '/notifications/unread-count'),
    (json) => (json['unreadCount'] as num).toInt(),
  );

  /// 알림 하나를 읽음으로 표시한다.
  Future<void> markRead(String notificationId) => _transport.send(
    'POST',
    '/notifications/${_segment(notificationId)}/read',
  );

  /// 모두 읽음으로 표시한다.
  Future<void> markAllRead() =>
      _transport.send('POST', '/notifications/read-all');

  /// 푸시 알림을 받고 있는지. 설정한 적이 없으면 true.
  Future<bool> isPushEnabled() async => parseResponse(
    await _transport.send('GET', '/notifications/settings'),
    (json) => json['pushEnabled'] as bool,
  );

  /// 푸시 알림을 켜거나 끈다 (가게 앱의 배달 알림, 라이더 앱의 콜 알림).
  /// 꺼도 알림함에는 쌓인다.
  Future<bool> setPushEnabled(bool enabled) async => parseResponse(
    await _transport.send(
      'PATCH',
      '/notifications/settings',
      body: {'pushEnabled': enabled},
    ),
    (json) => json['pushEnabled'] as bool,
  );
}

/// 공지사항. 이 앱에 해당하는 공지만 온다.
class NoticesApi {
  NoticesApi(this._transport);

  final ApiTransport _transport;

  /// 공지 목록 (최근 것부터). 본문은 [get]으로 받는다.
  Future<Paged<NoticeSummary>> list({int page = 1, int size = 20}) async =>
      parseResponse(
        await _transport.send(
          'GET',
          '/notices',
          query: {'page': page, 'size': size},
        ),
        (json) => Paged.fromJson(json, NoticeSummary.fromJson),
      );

  /// 공지 상세. 내려갔거나 다른 앱 대상이면 [ApiErrorCode.noticeNotFound].
  Future<Notice> get(String noticeId) async => parseResponse(
    await _transport.send('GET', '/notices/${_segment(noticeId)}'),
    Notice.fromJson,
  );
}

/// 약관·정책. 가입 화면에서도 보여야 해서 로그인 없이 부른다.
class LegalApi {
  LegalApi(this._transport, this._appRole);

  final ApiTransport _transport;
  final UserRole _appRole;

  /// 시행 중인 약관·정책 목록. 운영자가 아직 올리지 않은 종류는 빠져 있다.
  /// 이 앱에 해당하는 것만 온다 — 라이더 이용약관은 라이더 앱에만 온다.
  Future<List<LegalDocumentSummary>> documents() async => parseListResponse(
    await _transport.send(
      'GET',
      '/legal/documents',
      query: {'audience': _appRole.wire},
      authenticated: false,
    ),
    LegalDocumentSummary.fromJson,
  );

  /// 약관·정책 본문. 아직 올라오지 않았으면 null.
  Future<LegalDocument?> document(LegalDocumentType type) async {
    try {
      return parseResponse(
        await _transport.send(
          'GET',
          '/legal/documents/${type.wire}',
          authenticated: false,
        ),
        LegalDocument.fromJson,
      );
    } on ApiException catch (error) {
      if (error.code == ApiErrorCode.legalDocumentNotFound) return null;
      rethrow;
    }
  }
}

/// 고객센터. 로그인하지 못한 사람도 연락할 수 있어야 해서 로그인 없이 부른다.
class SupportApi {
  SupportApi(this._transport);

  final ApiTransport _transport;

  /// 고객센터 연락처.
  Future<SupportContact> contact() async => parseResponse(
    await _transport.send('GET', '/support/contact', authenticated: false),
    SupportContact.fromJson,
  );

  /// 사업자 정보 (상호·대표자·사업자등록번호·통신판매업 신고·주소·고객센터).
  Future<BusinessInfo> business() async => parseResponse(
    await _transport.send('GET', '/support/business', authenticated: false),
    BusinessInfo.fromJson,
  );
}

/// 주소 검색. 카카오 로컬 API를 서버가 대신 부른다 — 키는 서버에만 있다.
class AddressSearchApi {
  AddressSearchApi(this._transport);

  final ApiTransport _transport;

  /// 도로명·지번 주소나 건물·장소 이름으로 찾는다. 주소로 찾은 것이 앞에 오고, 15곳까지 온다.
  /// 빈 검색어는 서버에 묻지 않고 빈 목록. 검색 서비스가 잠시 안 되면 [ApiErrorCode.addressSearchUnavailable].
  Future<List<FoundAddress>> search(String query) async {
    final trimmed = query.trim();
    if (trimmed.isEmpty) return const [];
    return parseListResponse(
      await _transport.send(
        'GET',
        '/address-search',
        query: {'query': trimmed},
      ),
      FoundAddress.fromJson,
    );
  }
}
