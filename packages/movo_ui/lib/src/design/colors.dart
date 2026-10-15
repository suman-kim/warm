import 'package:flutter/cupertino.dart' show CupertinoPageTransitionsBuilder;
import 'package:flutter/material.dart';

/// 브랜드 색. 화면에서는 대부분 [MovoColors]의 역할별 색을 쓴다.
abstract final class MovoPalette {
  static const lime = Color(0xFFC6F432);
  static const ink = Color(0xFF121212);
  static const paper = Color(0xFFF7F6F2);
  static const night = Color(0xFF0F1012);
  static const white = Color(0xFFFFFFFF);

  /// 밝은 바탕 위의 라임색 글자 (라임은 밝은 바탕에서 읽히지 않는다)
  static const limeText = Color(0xFF5A7A00);

  /// 실패·취소·경고 (결제 실패, 노쇼, 보류)
  static const danger = Color(0xFFB3261E);
  static const dangerSoft = Color(0xFFF8E4E1);

  /// 어두운 바탕(기사 앱)의 경고 글자와 바탕
  static const dangerOnNight = Color(0xFFFF7B6B);
  static const dangerNight = Color(0xFF3A2522);
}

/// 역할별 색. 고객 앱은 [light], 기사 앱은 [dark]를 쓴다 — 같은 화면 코드가 두 앱의 색으로 그려진다.
@immutable
class MovoColors extends ThemeExtension<MovoColors> {
  const MovoColors({
    required this.brightness,
    required this.background,
    required this.surface,
    required this.surfaceMuted,
    required this.surfaceSunken,
    required this.surfaceDeep,
    required this.text,
    required this.textSecondary,
    required this.textMuted,
    required this.textFaint,
    required this.placeholder,
    required this.fieldBorder,
    required this.divider,
    required this.separator,
    required this.focus,
    required this.primary,
    required this.onPrimary,
    required this.primaryDisabled,
    required this.onPrimaryDisabled,
    required this.accentText,
    required this.navBackground,
    required this.navBorder,
    required this.navActiveIcon,
    required this.avatar,
    required this.onAvatar,
    required this.toggleOn,
    required this.toggleKnobOn,
    required this.toggleOff,
    required this.toggleKnobOff,
    required this.progressOff,
    required this.scrim,
  });

  final Brightness brightness;

  /// 화면 바탕
  final Color background;

  /// 카드·입력란·시트
  final Color surface;

  /// 카드 위의 작은 버튼, 안내 타일
  final Color surfaceMuted;

  /// 목록의 아이콘 타일
  final Color surfaceSunken;

  /// 홈의 큰 패널 (어두운 테마에서 카드보다 한 단계 어둡다)
  final Color surfaceDeep;
  final Color text;

  /// 본문보다 한 단계 옅은 글자 (약관 항목, 선택되지 않은 칩)
  final Color textSecondary;

  /// 보조 설명, 라벨
  final Color textMuted;

  /// 어두운 카드 위의 라벨 (밝은 테마에서는 [textMuted]와 같다)
  final Color textFaint;
  final Color placeholder;
  final Color fieldBorder;
  final Color divider;

  /// 글자 사이의 세로 구분선, 시트 손잡이
  final Color separator;

  /// 입력 중인 칸의 테두리·라벨·커서
  final Color focus;

  /// 주 버튼
  final Color primary;
  final Color onPrimary;
  final Color primaryDisabled;
  final Color onPrimaryDisabled;

  /// 강조 글자 (충족한 조건, 진행 상태)
  final Color accentText;
  final Color navBackground;
  final Color navBorder;
  final Color navActiveIcon;
  final Color avatar;
  final Color onAvatar;
  final Color toggleOn;
  final Color toggleKnobOn;
  final Color toggleOff;
  final Color toggleKnobOff;

  /// 진행 막대의 아직 차지 않은 칸
  final Color progressOff;
  final Color scrim;

  bool get isDark => brightness == Brightness.dark;

  static const light = MovoColors(
    brightness: Brightness.light,
    background: MovoPalette.paper,
    surface: MovoPalette.white,
    surfaceMuted: Color(0xFFECEAE4),
    surfaceSunken: Color(0xFFF1F0EB),
    surfaceDeep: MovoPalette.white,
    text: MovoPalette.ink,
    textSecondary: Color(0xFF4A4A46),
    textMuted: Color(0xFF6B6B66),
    textFaint: Color(0xFF6B6B66),
    placeholder: Color(0xFF9A9A95),
    fieldBorder: Color(0xFFE6E4DE),
    divider: Color(0xFFEFEDE8),
    separator: Color(0xFFD4D2CB),
    focus: MovoPalette.ink,
    primary: MovoPalette.ink,
    onPrimary: MovoPalette.white,
    primaryDisabled: Color(0xFFE6E4DE),
    onPrimaryDisabled: Color(0xFF9A9A95),
    accentText: MovoPalette.limeText,
    navBackground: MovoPalette.white,
    navBorder: Color(0xFFE6E4DE),
    navActiveIcon: MovoPalette.ink,
    avatar: MovoPalette.ink,
    onAvatar: MovoPalette.lime,
    toggleOn: MovoPalette.ink,
    toggleKnobOn: MovoPalette.lime,
    toggleOff: Color(0xFFD4D2CB),
    toggleKnobOff: MovoPalette.white,
    progressOff: Color(0xFFECEAE4),
    scrim: Color(0x66000000),
  );

  static const dark = MovoColors(
    brightness: Brightness.dark,
    background: MovoPalette.night,
    surface: Color(0xFF1A1C1F),
    surfaceMuted: Color(0xFF26292D),
    surfaceSunken: Color(0xFF26292D),
    surfaceDeep: Color(0xFF16181B),
    text: Color(0xFFF2F2EE),
    textSecondary: Color(0xFFC9CBCF),
    textMuted: Color(0xFF8E9196),
    textFaint: Color(0xFFA5A8AD),
    placeholder: Color(0xFF8E9196),
    fieldBorder: Color(0xFF2C2F33),
    divider: Color(0xFF26292D),
    separator: Color(0xFF3A3D42),
    focus: MovoPalette.lime,
    primary: MovoPalette.lime,
    onPrimary: MovoPalette.ink,
    primaryDisabled: Color(0xFF26292D),
    onPrimaryDisabled: Color(0xFF8E9196),
    accentText: MovoPalette.lime,
    navBackground: Color(0xFF16181B),
    navBorder: Color(0xFF23262A),
    navActiveIcon: MovoPalette.lime,
    avatar: MovoPalette.lime,
    onAvatar: MovoPalette.ink,
    toggleOn: MovoPalette.lime,
    toggleKnobOn: MovoPalette.ink,
    toggleOff: Color(0xFF3A3D42),
    toggleKnobOff: Color(0xFF8E9196),
    progressOff: Color(0xFF2C2F33),
    scrim: Color(0x99000000),
  );

  @override
  MovoColors copyWith() => this;

  @override
  MovoColors lerp(MovoColors? other, double t) =>
      t < 0.5 ? this : other ?? this;
}

extension MovoColorsOf on BuildContext {
  MovoColors get colors => Theme.of(this).extension<MovoColors>()!;
}

const _weights = {
  400: FontWeight.w400,
  500: FontWeight.w500,
  600: FontWeight.w600,
  700: FontWeight.w700,
  800: FontWeight.w800,
  900: FontWeight.w900,
};

/// 디자인의 글자 값을 그대로 옮기는 스타일. [ls]는 em 단위 자간, [height]는 줄 높이 배수다.
/// 글꼴과 기본 색은 테마에서 물려받는다.
TextStyle mv(
  double size,
  int weight, {
  Color? color,
  double ls = 0,
  double? height,
  bool tabular = false,
  TextDecoration? decoration,
}) => TextStyle(
  fontSize: size,
  fontWeight: _weights[weight]!,
  color: color,
  letterSpacing: ls == 0 ? null : size * ls,
  height: height,
  leadingDistribution: TextLeadingDistribution.even,
  fontFeatures: tabular ? const [FontFeature.tabularFigures()] : null,
  decoration: decoration,
  decorationColor: color,
);

/// 앱 테마. 고객 앱은 밝은 테마, 기사 앱은 어두운 테마다.
ThemeData movoTheme(Brightness brightness) {
  final colors = brightness == Brightness.dark
      ? MovoColors.dark
      : MovoColors.light;
  final base = ThemeData(
    brightness: brightness,
    useMaterial3: true,
    fontFamily: 'SUIT',
    package: 'movo_ui',
    scaffoldBackgroundColor: colors.background,
    colorScheme: ColorScheme.fromSeed(
      seedColor: MovoPalette.lime,
      brightness: brightness,
      primary: colors.primary,
      onPrimary: colors.onPrimary,
      surface: colors.surface,
      onSurface: colors.text,
    ),
    splashFactory: NoSplash.splashFactory,
    highlightColor: Colors.transparent,
    extensions: [colors],
  );
  return base.copyWith(
    textTheme: base.textTheme.apply(
      bodyColor: colors.text,
      displayColor: colors.text,
    ),
    textSelectionTheme: TextSelectionThemeData(
      cursorColor: colors.focus,
      selectionColor: MovoPalette.lime.withValues(alpha: 0.45),
      selectionHandleColor: colors.focus,
    ),
    pageTransitionsTheme: const PageTransitionsTheme(
      builders: {
        TargetPlatform.android: CupertinoPageTransitionsBuilder(),
        TargetPlatform.iOS: CupertinoPageTransitionsBuilder(),
      },
    ),
  );
}
