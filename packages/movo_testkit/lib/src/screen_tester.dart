import 'dart:io';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:movo_api/movo_api.dart';
import 'package:movo_ui/movo_ui.dart';

import 'system_bars.dart';

const _fontFiles = [
  'SUIT-Regular.otf',
  'SUIT-Medium.otf',
  'SUIT-SemiBold.otf',
  'SUIT-Bold.otf',
  'SUIT-ExtraBold.otf',
  'SUIT-Heavy.otf',
];

bool _fontsLoaded = false;

/// 테스트에서 실제 글꼴로 그리게 한다. 부르지 않으면 글자가 네모로 나온다.
Future<void> loadMovoFonts() async {
  if (_fontsLoaded) return;
  // 테스트를 돌리는 폴더(패키지 루트)에 따라 글꼴 폴더의 위치가 다르다.
  final dir = [
    'fonts',
    '../movo_ui/fonts',
    '../packages/movo_ui/fonts',
  ].map(Directory.new).firstWhere((dir) => dir.existsSync());
  final loader = FontLoader('packages/movo_ui/SUIT');
  for (final file in _fontFiles) {
    final bytes = File('${dir.path}/$file').readAsBytesSync();
    loader.addFont(Future.value(ByteData.sublistView(bytes)));
  }
  await loader.load();
  _fontsLoaded = true;
}

final _boundary = GlobalKey();

/// 화면을 띄워 보는 테스트. `testWidgets`와 같지만 그림자를 실제처럼 그린다 —
/// 테스트는 기본으로 그림자를 검은 덩어리로 그려서, 화면 사진에 쓸 수 없다.
void testScreen(
  String description,
  Future<void> Function(WidgetTester tester) body,
) => testWidgets(description, (tester) async {
  debugDisableShadows = false;
  try {
    await body(tester);
    // 화면 사진을 찍지 않은 테스트도 마지막 화면은 본다.
    await expectClearOfSystemBars(tester, '$description (마지막 화면)');
    // 화면을 내리고, 주기적으로 새로 받던 타이머가 끝나도록 시간을 흘려보낸다.
    await tester.pumpWidget(const SizedBox.shrink());
    await tester.pump(const Duration(seconds: 30));
  } finally {
    // 테스트가 끝날 때 원래 값이 아니면 프레임워크가 실패로 본다.
    debugDisableShadows = true;
  }
});

/// 디자인의 기기 크기(375×812)로 화면 하나를 띄운다. 위 50, 아래 48의 안전 영역 —
/// 아래는 Android 3버튼 내비게이션 바 높이다 (iPhone 홈 인디케이터 34보다 높다).
///
/// [user]를 주면 그 회원으로 로그인한 상태다. 움직이는 요소가 있는 화면이 많아
/// `pumpAndSettle` 대신 정해진 시간만큼만 그린다.
Future<Session> pumpScreen(
  WidgetTester tester, {
  required MovoApi api,
  required MovoAppProfile profile,
  required Widget screen,
  Map<String, dynamic>? user,
  ExternalLauncher launcher = const NoExternalLauncher(),
  Size size = const Size(375, 812),
}) async {
  final session = Session(api);
  if (user != null) session.updateUser(User.fromJson(user));
  addTearDown(session.dispose);
  await pumpApp(
    tester,
    MovoHost(
      session: session,
      profile: profile,
      launcher: launcher,
      home: screen,
    ),
    size: size,
  );
  return session;
}

/// 앱 전체(또는 아무 위젯)를 디자인의 기기 크기로 띄운다.
Future<void> pumpApp(
  WidgetTester tester,
  Widget app, {
  Size size = const Size(375, 812),
}) async {
  await loadMovoFonts();
  tester.view.devicePixelRatio = 3;
  tester.view.physicalSize = size * 3;
  // 실제 기기처럼 viewPadding에도 준다 — 떠 있는 토스트(SnackBar)는 viewPadding으로 자리를 잡는다.
  tester.view.padding = const FakeViewPadding(top: 150, bottom: 144);
  tester.view.viewPadding = const FakeViewPadding(top: 150, bottom: 144);
  addTearDown(tester.view.reset);
  await tester.pumpWidget(RepaintBoundary(key: _boundary, child: app));
  await settle(tester);
}

/// 서버 응답(가짜)이 도착하고 그림이 풀릴 시간을 준 뒤 다시 그린다.
Future<void> settle(WidgetTester tester, {int rounds = 4}) async {
  for (var i = 0; i < rounds; i++) {
    await tester.runAsync(
      () => Future<void>.delayed(const Duration(milliseconds: 20)),
    );
    await tester.pump(const Duration(milliseconds: 120));
  }
}

/// 지금 화면을 `build/screenshots/[name].png`로 저장한다. 디자인과 눈으로 견줄 때 쓴다.
/// 저장한 뒤 글자·아이콘이 화면 아래 시스템 영역과 겹치지 않는지도 본다.
Future<void> screenshot(WidgetTester tester, String name) async {
  final boundary =
      _boundary.currentContext!.findRenderObject()! as RenderRepaintBoundary;
  final bytes = await tester.runAsync(() async {
    final image = await boundary.toImage(pixelRatio: 2);
    final data = await image.toByteData(format: ui.ImageByteFormat.png);
    return data!.buffer.asUint8List();
  });
  final file = File('build/screenshots/$name.png');
  file.parent.createSync(recursive: true);
  file.writeAsBytesSync(bytes!);
  await expectClearOfSystemBars(tester, name);
}
