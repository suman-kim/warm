import 'dart:io';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:movo_testkit/movo_testkit.dart';
import 'package:movo_ui/movo_ui.dart';

// 앱 아이콘과 스플래시의 원본 그림을 앱의 로고(MovoLogo)로 그린다 — 앱 안의 로고와 글꼴·비율이 같다.
// 로고를 바꾸면 다시 그리고, 각 앱에서 아이콘·스플래시를 다시 만든다:
//
//   cd packages/movo_ui && flutter test tool/brand_assets_test.dart
//   cd customer-app && dart run flutter_launcher_icons && dart run flutter_native_splash:create
//   cd driver-app   && dart run flutter_launcher_icons && dart run flutter_native_splash:create
//
// 고객 앱은 밝은 화면(종이색), 기사 앱은 어두운 화면(밤색)이라 스플래시도 그 색 하나다.
// 아이콘: 고객 앱은 라임 바탕에 잉크색 로고, 기사 앱은 잉크 바탕에 흰 로고와 라임 '기사' 꼬리표.

/// 그림의 논리 크기에 곱하는 배율 — 256 × 4 = 1024px.
const _scale = 4.0;

class _Asset {
  const _Asset(
    this.path, {
    required this.size,
    this.width,
    required this.brightness,
    required this.mark,
    this.background,
    this.lift = 0.087,
  });

  /// 저장할 곳 (packages/movo_ui에서 본 경로)
  final String path;

  /// 그림의 논리 크기 (너비, 높이). 저장되는 픽셀은 × [_scale].
  final Size size;

  /// 로고(꼬리표 포함)가 차지할 너비 (논리 크기). null이면 로고 본래 크기 — 스플래시.
  final double? width;
  final Brightness brightness;
  final Widget mark;

  /// null이면 투명 — 안드로이드 적응형 아이콘의 앞면, 스플래시
  final Color? background;

  /// 로고를 자기 높이의 이만큼 올린다. 소문자 'mov'는 글자 상자의 위쪽(대문자 자리)이 비어
  /// 상자를 가운데 두면 글자가 아래로 처져 보인다.
  final double lift;
}

/// 고객 앱의 로고 (아이콘용 — 너비에 맞춰 키운다).
const _logo = MovoLogo(size: 100);

/// 스플래시의 로고 — 앱이 시작하며 띄우는 화면(MovoApp의 로딩)과 같은 크기라 이어서 보인다.
const _splashLogo = MovoLogo(size: 36);
const _driverSplashLogo = MovoLogo(size: 36, badge: '기사');

/// 기사 앱 아이콘 — 정사각형 안에서 읽히게 '기사' 꼬리표를 로고 아래에 둔다.
const _driverIconMark = Column(
  mainAxisSize: MainAxisSize.min,
  children: [
    MovoLogo(size: 100),
    SizedBox(height: 18),
    MovoTag(
      '기사',
      background: MovoPalette.lime,
      foreground: MovoPalette.ink,
      fontSize: 34,
      padding: EdgeInsets.symmetric(horizontal: 22, vertical: 10),
      radius: 20,
    ),
  ],
);

// 크기 기준 (논리 크기):
// - 아이콘 256: 로고 너비 62%.
// - 적응형 아이콘 앞면 256: 기기가 가운데 지름 66%의 원만 남길 수 있어 그 안에 든다.
// - 스플래시: 로고 본래 크기(앱의 로딩 화면과 같다), 4배로 저장 — 패키지가 해상도별로 줄인다.
// - 안드로이드 12+ 스플래시 288: 가운데 지름 192(2/3)의 원 안에 든다. 로고는 본래 크기.
const _customer = '../../customer-app/assets/brand';
const _driver = '../../driver-app/assets/brand';
final _assets = [
  const _Asset(
    '$_customer/icon.png',
    size: Size.square(256),
    width: 160,
    brightness: Brightness.light,
    mark: _logo,
    background: MovoPalette.lime,
  ),
  const _Asset(
    '$_customer/icon_foreground.png',
    size: Size.square(256),
    width: 132,
    brightness: Brightness.light,
    mark: _logo,
  ),
  const _Asset(
    '$_customer/splash.png',
    size: Size(110, 60),
    brightness: Brightness.light,
    mark: _splashLogo,
    lift: 0,
  ),
  const _Asset(
    '$_customer/android12.png',
    size: Size.square(288),
    brightness: Brightness.light,
    mark: _splashLogo,
    lift: 0,
  ),
  const _Asset(
    '$_driver/icon.png',
    size: Size.square(256),
    width: 150,
    brightness: Brightness.dark,
    mark: _driverIconMark,
    background: MovoPalette.ink,
  ),
  const _Asset(
    '$_driver/icon_foreground.png',
    size: Size.square(256),
    width: 112,
    brightness: Brightness.dark,
    mark: _driverIconMark,
  ),
  const _Asset(
    '$_driver/splash.png',
    size: Size(160, 60),
    brightness: Brightness.dark,
    mark: _driverSplashLogo,
    lift: 0,
  ),
  const _Asset(
    '$_driver/android12.png',
    size: Size.square(288),
    brightness: Brightness.dark,
    mark: _driverSplashLogo,
    lift: 0,
  ),
];

void main() {
  testWidgets('앱 아이콘·스플래시 원본 그림', (tester) async {
    await loadMovoFonts();
    tester.view
      ..physicalSize = const Size(1200, 1200)
      ..devicePixelRatio = 1;
    addTearDown(tester.view.reset);

    for (final asset in _assets) {
      final boundary = GlobalKey();
      await tester.pumpWidget(
        MediaQuery(
          data: const MediaQueryData(),
          child: Directionality(
            textDirection: TextDirection.ltr,
            child: Theme(
              data: movoTheme(asset.brightness),
              child: Align(
                alignment: Alignment.topLeft,
                child: RepaintBoundary(
                  key: boundary,
                  child: Container(
                    width: asset.size.width,
                    height: asset.size.height,
                    color: asset.background ?? Colors.transparent,
                    alignment: Alignment.center,
                    // 앱에서는 화면(Material)이 테마의 글꼴과 글자색을 내려준다 — 여기서는 직접 준다.
                    child: Builder(
                      builder: (context) => DefaultTextStyle(
                        style: Theme.of(context).textTheme.bodyMedium!.copyWith(
                          color: context.colors.text,
                        ),
                        child: FractionalTranslation(
                          translation: Offset(0, -asset.lift),
                          child: asset.width == null
                              ? asset.mark
                              : SizedBox(
                                  width: asset.width,
                                  child: FittedBox(child: asset.mark),
                                ),
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      );
      final bytes = await tester.runAsync(() async {
        final render =
            boundary.currentContext!.findRenderObject()!
                as RenderRepaintBoundary;
        final image = await render.toImage(pixelRatio: _scale);
        final data = await image.toByteData(format: ui.ImageByteFormat.png);
        return data!.buffer.asUint8List();
      });
      File(asset.path)
        ..parent.createSync(recursive: true)
        ..writeAsBytesSync(bytes!);
    }
  });
}
