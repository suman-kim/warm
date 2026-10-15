import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:movo_api/movo_api.dart';

import 'colors.dart';
import 'kakao_map.dart';

// 지도. 기기에서 카카오 지도 SDK를 초기화했으면(MovoMaps.ready) 카카오 지도로 그리고,
// 아니면(테스트, 키가 없을 때, 지도를 띄우지 못했을 때) 디자인의 지도 그림으로 그린다.
// 그림 지도의 길과 강은 장식이고 실제 지리와 무관하다 — 경로 선과 표시만 실제 좌표를 따른다.
// 화면은 어느 쪽이든 경로 좌표와 표시할 위젯만 넘긴다.

String _art({
  required String ground,
  required String park,
  required String river,
  required String street,
  required String avenue,
}) =>
    '<svg viewBox="-300 -300 1300 1400">'
    '<rect x="-300" y="-300" width="1300" height="1400" fill="$ground"/>'
    '<path d="M40 250q20-30 70-22q34 8 20 42q-16 28-60 22q-40-8-30-42z" fill="$park"/>'
    '<path d="M380 560q30-14 48 6q10 26-18 34q-34 6-30-40z" fill="$park"/>'
    '<path d="M-300 400C-200 420-150 360-100 380C40 330 160 410 260 370S440 300 600 330S800 360 900 340" fill="none" stroke="$river" stroke-width="58"/>'
    '<path d="M-300 120H900M-300 200H900M60-300V330M230-300L240 330M400-300L405 300M620-300V900M-300 520H900M-300 610H900M230 410V900M440 360V900" fill="none" stroke="$street" stroke-width="4" stroke-linecap="round"/>'
    '<path d="M-300 360C-200 380-150 320-100 340C40 290 160 370 260 330S440 260 600 290S800 320 900 300M-300 440C-200 460-150 400-100 420C40 370 160 450 260 410S440 340 600 370S800 400 900 380M150 150L175 600M300 100L330 660" fill="none" stroke="$avenue" stroke-width="8" stroke-linecap="round"/>'
    '</svg>';

final _lightArt = _art(
  ground: '#E4E2DA',
  park: '#D6DDC6',
  river: '#CFD6DA',
  street: '#FFFFFF',
  avenue: '#FFFFFF',
);
final _darkArt = _art(
  ground: '#16181B',
  park: '#1A211C',
  river: '#1E262C',
  street: '#23262A',
  avenue: '#2E3236',
);

/// 지도 위에 올리는 표시 하나. [child]의 가운데가 [point]에 놓인다.
class MovoMapMarker {
  const MovoMapMarker(this.point, this.child, {this.offset = Offset.zero});

  final Coordinates point;
  final Widget child;

  /// 좌표에서 비켜 놓을 거리 (표시 위에 이름표를 띄울 때).
  final Offset offset;
}

/// 경로와 표시를 그리는 지도.
class MovoMap extends StatelessWidget {
  const MovoMap({
    super.key,
    this.route = const [],
    this.traveled = const [],
    this.markers = const [],
    this.padding = const EdgeInsets.all(64),
    this.dark,
    this.zoom = 0.66,
    this.lineWidth,
  });

  /// 앞으로 갈 경로 (출발 → 도착 순).
  final List<Coordinates> route;

  /// 이미 지나온 구간. 흐린 점선으로 그린다.
  final List<Coordinates> traveled;
  final List<MovoMapMarker> markers;

  /// 경로가 이 여백 안쪽에 들어오게 맞춘다 — 아래 패널이 가리는 만큼을 준다.
  final EdgeInsets padding;

  /// 어두운 지도로 그릴지. 주지 않으면 테마를 따른다.
  final bool? dark;

  /// 바탕 그림의 배율.
  final double zoom;
  final double? lineWidth;

  @override
  Widget build(BuildContext context) {
    final isDark = dark ?? context.colors.isDark;
    if (MovoMaps.ready) {
      return KakaoRouteMap(
        route: route,
        traveled: traveled,
        markers: [
          for (final marker in markers)
            KakaoMarker(marker.point, marker.child, marker.offset),
        ],
        padding: padding,
        dark: isDark,
        lineWidth: lineWidth ?? (isDark ? 8 : 6),
        fallback: _picture(isDark),
      );
    }
    return _picture(isDark);
  }

  /// 디자인의 지도 그림 위에 경로와 표시를 그린다.
  Widget _picture(bool isDark) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final size = constraints.biggest;
        final project = _Projection([
          ...route,
          ...traveled,
          for (final m in markers) m.point,
        ], padding.deflateRect(Offset.zero & size));
        final center = padding.deflateRect(Offset.zero & size).center;
        return ClipRect(
          child: Stack(
            clipBehavior: Clip.none,
            children: [
              Positioned.fill(
                child: ColoredBox(
                  color: isDark
                      ? const Color(0xFF16181B)
                      : const Color(0xFFE4E2DA),
                ),
              ),
              Positioned(
                left: center.dx - 630 * zoom,
                top: center.dy - 680 * zoom,
                width: 1300 * zoom,
                height: 1400 * zoom,
                child: SvgPicture.string(isDark ? _darkArt : _lightArt),
              ),
              Positioned.fill(
                child: CustomPaint(
                  painter: _RoutePainter(
                    route: [for (final p in route) project(p)],
                    traveled: [for (final p in traveled) project(p)],
                    dark: isDark,
                    lineWidth: lineWidth ?? (isDark ? 10 : 4.6),
                  ),
                ),
              ),
              for (final marker in markers)
                Positioned(
                  left: project(marker.point).dx + marker.offset.dx,
                  top: project(marker.point).dy + marker.offset.dy,
                  child: FractionalTranslation(
                    translation: const Offset(-0.5, -0.5),
                    child: marker.child,
                  ),
                ),
            ],
          ),
        );
      },
    );
  }
}

/// 위경도를 화면 좌표로 옮긴다. 모든 점이 [area] 안에 들어오게 맞춘다.
class _Projection {
  _Projection(List<Coordinates> points, this.area) {
    if (points.isEmpty) return;
    final lats = points.map((p) => p.latitude);
    final lngs = points.map((p) => p.longitude);
    _minLng = lngs.reduce(math.min);
    _maxLat = lats.reduce(math.max);
    final midLat = (lats.reduce(math.min) + _maxLat) / 2;
    // 위도가 높을수록 경도 1도의 실제 거리가 짧다.
    _lngFactor = math.cos(midLat * math.pi / 180);
    final width = (lngs.reduce(math.max) - _minLng) * _lngFactor;
    final height = _maxLat - lats.reduce(math.min);
    // 두 점이 아주 가까워도 지나치게 확대하지 않는다 (1km를 120px까지만).
    const maxScale = 111.0 * 120;
    _scale = math.min(
      maxScale,
      math.min(
        width == 0 ? maxScale : area.width / width,
        height == 0 ? maxScale : area.height / height,
      ),
    );
    _origin = Offset(
      area.left + (area.width - width * _scale) / 2,
      area.top + (area.height - height * _scale) / 2,
    );
  }

  final Rect area;
  double _minLng = 0;
  double _maxLat = 0;
  double _lngFactor = 1;
  double _scale = 1;
  Offset? _origin;

  Offset call(Coordinates point) {
    final origin = _origin;
    if (origin == null) return area.center;
    return Offset(
      origin.dx + (point.longitude - _minLng) * _lngFactor * _scale,
      origin.dy + (_maxLat - point.latitude) * _scale,
    );
  }
}

class _RoutePainter extends CustomPainter {
  const _RoutePainter({
    required this.route,
    required this.traveled,
    required this.dark,
    required this.lineWidth,
  });

  final List<Offset> route;
  final List<Offset> traveled;
  final bool dark;
  final double lineWidth;

  Path _path(List<Offset> points) {
    final path = Path()..moveTo(points.first.dx, points.first.dy);
    for (final point in points.skip(1)) {
      path.lineTo(point.dx, point.dy);
    }
    return path;
  }

  @override
  void paint(Canvas canvas, Size size) {
    Paint stroke(Color color, double width) => Paint()
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round
      ..color = color
      ..strokeWidth = width;

    if (traveled.length > 1) {
      // 지나온 길은 점선으로.
      final paint = stroke(const Color(0xFFA9A9A3), 3)
        ..style = PaintingStyle.fill;
      for (final metric in _path(traveled).computeMetrics()) {
        for (var d = 0.0; d < metric.length; d += 6) {
          final tangent = metric.getTangentForOffset(d);
          if (tangent != null) canvas.drawCircle(tangent.position, 1.5, paint);
        }
      }
    }
    if (route.length > 1) {
      final path = _path(route);
      if (dark) {
        canvas.drawPath(path, stroke(const Color(0x38C6F432), lineWidth * 2.6));
        canvas.drawPath(path, stroke(MovoPalette.lime, lineWidth));
      } else {
        canvas.drawPath(path, stroke(MovoPalette.white, lineWidth * 2));
        canvas.drawPath(path, stroke(MovoPalette.ink, lineWidth));
      }
    }
  }

  @override
  bool shouldRepaint(_RoutePainter old) =>
      old.route != route ||
      old.traveled != traveled ||
      old.dark != dark ||
      old.lineWidth != lineWidth;
}

/// 지도 위의 출발지 표시 (라임색 점).
class MovoMapPickupDot extends StatelessWidget {
  const MovoMapPickupDot({super.key, this.halo = true, this.size = 22});

  final bool halo;
  final double size;

  @override
  Widget build(BuildContext context) => Container(
    width: size,
    height: size,
    decoration: BoxDecoration(
      color: MovoPalette.lime,
      shape: BoxShape.circle,
      border: Border.all(color: MovoPalette.ink, width: size * 0.18),
      boxShadow: halo
          ? const [BoxShadow(color: Color(0x80C6F432), spreadRadius: 9)]
          : null,
    ),
  );
}

/// 지도 위의 도착지 표시 (잉크색 네모).
class MovoMapDropoffDot extends StatelessWidget {
  const MovoMapDropoffDot({super.key, this.size = 20});

  final double size;

  @override
  Widget build(BuildContext context) => Container(
    width: size,
    height: size,
    decoration: BoxDecoration(
      color: MovoPalette.ink,
      borderRadius: BorderRadius.circular(size * 0.3),
      border: Border.all(color: MovoPalette.white, width: size * 0.17),
    ),
  );
}

/// 지도 위의 이름표 (출발 성수동, 도착 14:42).
class MovoMapLabel extends StatelessWidget {
  const MovoMapLabel(this.text, {super.key, this.prefix, this.inverse = false});

  final String text;

  /// 앞에 색을 달리해 붙이는 말 (출발, 도착).
  final String? prefix;

  /// 잉크색 바탕으로 그릴지 (도착지).
  final bool inverse;

  @override
  Widget build(BuildContext context) => Container(
    height: 28,
    padding: const EdgeInsets.symmetric(horizontal: 11),
    decoration: BoxDecoration(
      color: inverse ? MovoPalette.ink : MovoPalette.white,
      borderRadius: BorderRadius.circular(14),
      boxShadow: inverse
          ? null
          : const [
              BoxShadow(
                color: Color(0x66121212),
                blurRadius: 16,
                spreadRadius: -8,
                offset: Offset(0, 6),
              ),
            ],
    ),
    child: Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        if (prefix != null) ...[
          Text(
            prefix!,
            style: mv(
              12,
              800,
              color: inverse ? MovoPalette.lime : MovoPalette.limeText,
            ),
          ),
          const SizedBox(width: 5),
        ],
        Text(
          text,
          style: mv(
            12,
            800,
            color: inverse ? MovoPalette.white : MovoPalette.ink,
          ),
        ),
      ],
    ),
  );
}
