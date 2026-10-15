import 'package:flutter/foundation.dart' show kDebugMode;

import 'models/enums.dart';

/// 앱이 붙는 서버 환경. 빌드할 때 저장소의 환경 파일(`env/<이름>.json`)로 고른다:
///
///     flutter run --dart-define-from-file=../env/device.json
enum AppEnvironment {
  /// 이 컴퓨터에서 띄운 개발 서버 — 시뮬레이터·에뮬레이터, USB로 연결한 기기(`adb reverse`).
  local,

  /// 기기에 설치해 시험하는 빌드 — 시험 서버. 고정 HTTPS 주소, 또는 같은 와이파이에 있는
  /// 개발 컴퓨터의 사설 IP(HTTP, 예: http://192.168.0.211:4000/api).
  device,

  /// 운영 서버.
  prod,
}

/// 이 빌드가 붙는 서버. 환경마다 주소가 환경 파일 하나에 고정돼 있다.
class MovoEnvironment {
  const MovoEnvironment._(this.environment, this.apiBaseUrl);

  /// 빌드 때 넣은 `APP_ENV`, `API_BASE_URL`로 정한다. 규칙은 [MovoEnvironment.resolve].
  factory MovoEnvironment.fromBuild() => MovoEnvironment.resolve(
    appEnv: const String.fromEnvironment('APP_ENV'),
    apiBaseUrl: const String.fromEnvironment('API_BASE_URL'),
    debugBuild: kDebugMode,
  );

  /// 값을 확인해 환경을 정한다. 잘못됐으면 [MovoEnvironmentError]를 던진다.
  ///
  /// - 환경 파일 없이 켠 디버그 빌드는 [AppEnvironment.local]이다. 릴리스·프로파일 빌드는 환경 파일이 있어야 한다.
  /// - [AppEnvironment.local]은 주소를 비우면 [localApiBaseUrl]을 본다.
  /// - [AppEnvironment.device]와 [AppEnvironment.prod]는 주소가 있어야 하고, localhost일 수 없다.
  /// - [AppEnvironment.prod]는 HTTPS만 쓴다. [AppEnvironment.device]는 사설 IP(같은 와이파이의 개발 컴퓨터)에만
  ///   HTTP를 쓸 수 있다 — 기기가 집·사무실 와이파이에 있을 때만 닿는다.
  /// - [AppEnvironment.prod]는 터널 주소(ngrok 등)를 볼 수 없다.
  factory MovoEnvironment.resolve({
    required String appEnv,
    required String apiBaseUrl,
    required bool debugBuild,
  }) {
    if (appEnv.isEmpty && !debugBuild) {
      throw MovoEnvironmentError(
        '환경 파일 없이 빌드했어요. '
        '--dart-define-from-file=../env/<local|device|prod>.json 을 붙여 다시 빌드하세요.',
      );
    }
    final environment = appEnv.isEmpty
        ? AppEnvironment.local
        : AppEnvironment.values.asNameMap()[appEnv];
    if (environment == null) {
      throw MovoEnvironmentError(
        'APP_ENV=$appEnv — local, device, prod 중 하나여야 해요.',
      );
    }
    final name = environment.name;

    final raw = apiBaseUrl.trim();
    if (raw.isEmpty) {
      if (environment == AppEnvironment.local) {
        return MovoEnvironment._(environment, Uri.parse(localApiBaseUrl));
      }
      throw MovoEnvironmentError(
        'env/$name.json 의 API_BASE_URL이 비어 있어요. 이 환경이 붙을 서버 주소를 채우세요.',
      );
    }
    final url = Uri.tryParse(raw);
    if (url == null ||
        !(url.isScheme('http') || url.isScheme('https')) ||
        url.host.isEmpty) {
      throw MovoEnvironmentError(
        'API_BASE_URL=$raw — https://호스트/api 모양이어야 해요.',
      );
    }
    if (environment != AppEnvironment.local) {
      final lanHttp =
          environment == AppEnvironment.device && _privateIp.hasMatch(url.host);
      if (!url.isScheme('https') && !lanHttp) {
        // 암호화하지 않은 연결은 같은 와이파이 안(사설 IP)에서 시험할 때만 쓴다.
        throw MovoEnvironmentError(
          environment == AppEnvironment.device
              ? '$name 환경은 HTTPS 주소나 같은 와이파이의 사설 IP(예: http://192.168.0.10:4000/api)만 쓸 수 있어요 (API_BASE_URL=$raw).'
              : '$name 환경은 HTTPS 주소만 쓸 수 있어요 (API_BASE_URL=$raw).',
        );
      }
      if (_loopback.hasMatch(url.host)) {
        throw MovoEnvironmentError(
          '$name 환경이 $raw 를 보고 있어요. 기기에서 localhost는 이 컴퓨터가 아니에요.',
        );
      }
    }
    if (environment == AppEnvironment.prod && _tunnel.hasMatch(url.host)) {
      throw MovoEnvironmentError(
        '운영 빌드가 터널 주소(${url.host})를 보고 있어요. 운영 서버 주소를 채우세요.',
      );
    }
    // 끝의 /는 떼어 둔다 — 요청 경로(`/orders` 등)를 그대로 이어 붙인다.
    return MovoEnvironment._(
      environment,
      url.replace(path: url.path.replaceFirst(RegExp(r'/+$'), '')),
    );
  }

  /// [AppEnvironment.local]의 기본 주소 — 이 컴퓨터의 개발 서버.
  static const localApiBaseUrl = 'http://localhost:4000/api';

  /// 카카오 지도 SDK의 네이티브 앱 키 — 앱마다 다르다 (환경 파일의 `KAKAO_CUSTOMER_APP_KEY`,
  /// `KAKAO_DRIVER_APP_KEY`). 앱에 들어가는 키라 숨길 값은 아니고, 카카오 콘솔에서 그 키에 등록한
  /// 패키지명·키 해시·번들 ID의 앱에서만 동작한다. 비어 있으면 지도 대신 그림 지도를 쓴다.
  static String kakaoAppKeyFor(UserRole role) => switch (role) {
    UserRole.driver => const String.fromEnvironment('KAKAO_DRIVER_APP_KEY'),
    _ => const String.fromEnvironment('KAKAO_CUSTOMER_APP_KEY'),
  };

  static final _loopback = RegExp(
    r'^(localhost|127(\.\d+){3}|0\.0\.0\.0|::1)$',
  );

  /// 사설 IPv4 — 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16.
  static final _privateIp = RegExp(
    r'^(10(\.\d{1,3}){3}|172\.(1[6-9]|2\d|3[01])(\.\d{1,3}){2}|192\.168(\.\d{1,3}){2})$',
  );
  static final _tunnel = RegExp(
    r'(^|\.)(ngrok(-free)?\.(app|dev|io)|trycloudflare\.com|loca\.lt)$',
  );

  final AppEnvironment environment;

  /// 서버 API 주소. 끝에 /가 없다 (예: https://api.example.com/api).
  final Uri apiBaseUrl;

  @override
  String toString() => '${environment.name} ($apiBaseUrl)';
}

/// 환경 파일이 빠졌거나 값이 잘못된 빌드. 고쳐서 다시 빌드해야 한다.
class MovoEnvironmentError extends Error {
  MovoEnvironmentError(this.message);

  final String message;

  @override
  String toString() => '환경 설정 오류: $message';
}
