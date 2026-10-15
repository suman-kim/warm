import 'package:flutter/material.dart';
import 'package:movo_api/movo_api.dart';
import 'package:movo_ui/movo_ui.dart';

import 'api.dart' as real;
import 'gate.dart';
import 'launcher.dart';
import 'services.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  try {
    debugPrint('MOVO 서버: ${real.environment}');
  } on MovoEnvironmentError catch (error) {
    // 환경 파일이 빠졌거나 값이 잘못된 빌드 — 앱 대신 이유를 띄운다.
    runApp(ErrorWidget(error));
    rethrow;
  }
  // 카카오 지도·카카오내비 — 키가 없거나 준비하지 못하면 그림 지도와 기기의 지도 앱을 쓴다.
  final kakaoAppKey = MovoEnvironment.kakaoAppKeyFor(UserRole.driver);
  await MovoMaps.initialize(kakaoAppKey);
  await KakaoNaviGuide.initialize(kakaoAppKey);
  runApp(const DriverApp());
}

/// 기사 앱. 콜을 수락하고 배송을 진행한다.
class DriverApp extends StatelessWidget {
  const DriverApp({super.key, this.api});

  /// 서버 API. 주지 않으면 앱의 기본 API(실제 서버)를 쓴다 — 테스트에서 가짜 서버를 끼울 때 준다.
  final MovoApi? api;

  @override
  Widget build(BuildContext context) => MovoApp(
    api: api ?? real.api,
    profile: MovoAppProfile.driver,
    title: 'MOVO Driver',
    launcher: const UrlLauncher(),
    home: (_) => const DriverGate(),
  );
}
