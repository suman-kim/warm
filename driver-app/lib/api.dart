import 'package:movo_api/movo_api.dart';

/// 이 빌드가 붙는 서버. 저장소의 환경 파일(`../env/<local|device|prod>.json`)로 고른다 — README의 '서버 연결'.
final environment = MovoEnvironment.fromBuild();

/// 앱 전체가 함께 쓰는 서버 API. 토큰은 기기의 보안 저장소에 둔다.
final api = MovoApi(baseUrl: environment.apiBaseUrl, appRole: UserRole.driver);
