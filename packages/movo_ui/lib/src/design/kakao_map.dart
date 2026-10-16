import 'dart:io';
import 'dart:math' as math;

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:kakao_map_sdk/kakao_map_sdk.dart' as kakao;
import 'package:movo_api/movo_api.dart';

import 'colors.dart';

// 카카오맵으로 그리는 지도. MovoMap이 카카오 지도를 쓸 수 있을 때(앱 키로 초기화한 기기) 이것으로 그린다.
// 경로는 경로 선으로, 표시(MovoMapMarker)는 위젯을 그림으로 바꿔 지도 위 표시(Poi)로 올린다.

/// 카카오 지도 SDK의 상태. 앱이 시작할 때 [initialize]를 부른다.
abstract final class MovoMaps {
  static bool _ready = false;

  /// 카카오 지도를 쓸 수 있는지. 아니면 MovoMap은 그림 지도로 그린다 (테스트, 키가 없을 때).
  static bool get ready => _ready;

  /// 앱 키로 카카오 지도 SDK를 초기화한다. 키가 비었거나 Android·iOS가 아니면 그림 지도를 쓴다.
  /// 실패해도 앱은 그림 지도로 계속 돈다.
  static Future<void> initialize(String appKey) async {
    if (appKey.isEmpty || kIsWeb || !(Platform.isAndroid || Platform.isIOS)) {
      return;
    }
    try {
      await kakao.KakaoMapSdk.instance.initialize(appKey);
      _ready = true;
    } on Object catch (error) {
      debugPrint('카카오 지도를 쓰지 못해 그림 지도로 그려요: $error');
    }
  }
}

/// 지도 위에 올릴 표시 하나 (MovoMap이 넘긴다).
class KakaoMarker {
  const KakaoMarker(this.point, this.child, this.offset);

  final Coordinates point;
  final Widget child;
  final Offset offset;
}

/// 카카오 지도에 경로와 표시를 그린다. 경로·표시가 바뀌면 다시 그리고, 보여 줄 범위가 바뀌면
/// 모든 점이 [padding] 안쪽에 들어오게 카메라를 옮긴다. 지도를 띄우지 못하면 [fallback]을 보여준다.
class KakaoRouteMap extends StatefulWidget {
  const KakaoRouteMap({
    super.key,
    required this.route,
    required this.traveled,
    required this.markers,
    required this.padding,
    required this.dark,
    required this.lineWidth,
    required this.fallback,
  });

  final List<Coordinates> route;
  final List<Coordinates> traveled;
  final List<KakaoMarker> markers;
  final EdgeInsets padding;
  final bool dark;
  final double lineWidth;
  final Widget fallback;

  @override
  State<KakaoRouteMap> createState() => _KakaoRouteMapState();
}

class _KakaoRouteMapState extends State<KakaoRouteMap> {
  kakao.KakaoMapController? _controller;
  final _routes = <kakao.BaseRoute>[];
  final _pois = <kakao.Poi>[];
  Size _size = Size.zero;
  String? _drawn;
  String? _framed;
  bool _failed = false;

  /// 그리는 중에 또 바뀌면 끝난 뒤 한 번 더 그린다.
  bool _drawing = false;
  bool _again = false;

  List<Coordinates> get _points => [
    ...widget.route,
    ...widget.traveled,
    for (final marker in widget.markers) marker.point,
  ];

  static String _key(Iterable<Coordinates> points, int digits) => [
    for (final p in points)
      '${p.latitude.toStringAsFixed(digits)},${p.longitude.toStringAsFixed(digits)}',
  ].join(';');

  @override
  void didUpdateWidget(KakaoRouteMap oldWidget) {
    super.didUpdateWidget(oldWidget);
    _sync();
  }

  /// 내용이 바뀌었으면 다시 그리고, 보여 줄 범위(약 100m 단위)가 바뀌었으면 카메라를 맞춘다.
  /// 라이더 위치처럼 조금씩 움직이는 것은 카메라를 흔들지 않는다.
  Future<void> _sync() async {
    final controller = _controller;
    if (controller == null || !mounted) return;
    if (_drawing) {
      _again = true;
      return;
    }
    _drawing = true;
    try {
      final drawn = [
        _key(widget.route, 6),
        _key(widget.traveled, 6),
        _key(widget.markers.map((m) => m.point), 6),
        widget.markers.map((m) => m.child.runtimeType).join(','),
        widget.dark,
      ].join('|');
      if (drawn != _drawn) {
        _drawn = drawn;
        await _draw(controller);
      }
      final framed = _key(_points, 3);
      if (framed != _framed && _size != Size.zero) {
        _framed = framed;
        await _frame(controller);
      }
    } on Object catch (error) {
      debugPrint('카카오 지도에 그리지 못했어요: $error');
    } finally {
      _drawing = false;
    }
    if (_again) {
      _again = false;
      await _sync();
    }
  }

  Future<void> _draw(kakao.KakaoMapController controller) async {
    for (final route in _routes) {
      await controller.routeLayer.removeRoute(route);
    }
    _routes.clear();
    for (final poi in _pois) {
      await controller.labelLayer.removePoi(poi);
    }
    _pois.clear();

    kakao.LatLng at(Coordinates p) => kakao.LatLng(p.latitude, p.longitude);
    if (widget.traveled.length >= 2) {
      _routes.add(
        await controller.routeLayer.addRoute(
          [for (final p in widget.traveled) at(p)],
          kakao.RouteStyle(
            const Color(0xFFA9A9A3),
            math.max(3, widget.lineWidth * 0.6),
          ),
          zOrder: 1,
        ),
      );
    }
    if (widget.route.length >= 2) {
      _routes.add(
        await controller.routeLayer.addRoute(
          [for (final p in widget.route) at(p)],
          kakao.RouteStyle(
            widget.dark ? MovoPalette.lime : MovoPalette.ink,
            widget.lineWidth,
            strokeColor: widget.dark ? MovoPalette.ink : MovoPalette.white,
            strokeWidth: 2,
          ),
          zOrder: 2,
        ),
      );
    }
    if (!mounted) return;
    for (final marker in widget.markers) {
      final icon = await _image(marker);
      if (!mounted) return;
      _pois.add(
        await controller.labelLayer.addPoi(
          at(marker.point),
          style: kakao.PoiStyle(
            icon: icon,
            anchor: const kakao.KPoint(0.5, 0.5),
          ),
        ),
      );
    }
  }

  /// 표시 위젯을 그림으로 바꾼다. 앱의 테마와 글꼴을 그대로 쓴다. 표시가 비켜 놓인 만큼
  /// 그림을 넓혀, 그림의 가운데가 좌표에 놓이게 한다.
  Future<kakao.KImage> _image(KakaoMarker marker) {
    const box = Size(220, 120);
    final size = Size(
      box.width + marker.offset.dx.abs() * 2,
      box.height + marker.offset.dy.abs() * 2,
    );
    return kakao.KImage.fromWidget(
      MediaQuery(
        data: MediaQuery.of(context),
        child: InheritedTheme.captureAll(
          context,
          Center(
            child: Transform.translate(
              offset: marker.offset,
              child: marker.child,
            ),
          ),
        ),
      ),
      size,
      context: context,
    );
  }

  /// 모든 점이 [KakaoRouteMap.padding] 안쪽에 들어오게 카메라를 옮긴다. SDK는 네 변에 같은 여백만
  /// 받으므로, 여백이 다른 만큼 범위를 넓힌 가상의 점을 함께 넘긴다.
  Future<void> _frame(kakao.KakaoMapController controller) async {
    final points = _points;
    if (points.isEmpty) return;
    final lats = points.map((p) => p.latitude);
    final lngs = points.map((p) => p.longitude);
    var south = lats.reduce(math.min), north = lats.reduce(math.max);
    var west = lngs.reduce(math.min), east = lngs.reduce(math.max);
    // 한 점뿐이거나 아주 가까우면 동네 하나가 보이게 넓힌다.
    const minSpan = 0.004;
    if (north - south < minSpan) {
      final mid = (north + south) / 2;
      south = mid - minSpan / 2;
      north = mid + minSpan / 2;
    }
    if (east - west < minSpan) {
      final mid = (east + west) / 2;
      west = mid - minSpan / 2;
      east = mid + minSpan / 2;
    }
    final p = widget.padding;
    final innerHeight = math.max(1.0, _size.height - p.top - p.bottom);
    final innerWidth = math.max(1.0, _size.width - p.left - p.right);
    final latPerPx = (north - south) / innerHeight;
    final lngPerPx = (east - west) / innerWidth;
    final fit = [
      kakao.LatLng(north + p.top * latPerPx, west - p.left * lngPerPx),
      kakao.LatLng(south - p.bottom * latPerPx, east + p.right * lngPerPx),
    ];
    await controller.moveCamera(
      kakao.CameraUpdate.fitMapPoints(fit, padding: 0),
    );
  }

  Future<void> _ready(kakao.KakaoMapController controller) async {
    _controller = controller;
    if (widget.dark) {
      // 지도 바탕만 어둡게 덮는다 — 경로와 표시는 밝게 남는다. 안 되면 밝은 지도로 둔다.
      try {
        await controller.dimScreen.setCover(kakao.DimScreenCover.map);
        await controller.dimScreen.setColor(const Color(0xB30F1012));
        await controller.dimScreen.setVisible(true);
      } on Object catch (error) {
        debugPrint('카카오 지도를 어둡게 덮지 못했어요: $error');
      }
    }
    await _sync();
  }

  @override
  Widget build(BuildContext context) {
    if (_failed) return widget.fallback;
    final points = _points;
    final center = points.isEmpty
        ? const kakao.LatLng(37.5665, 126.9780)
        : kakao.LatLng(
            points.map((p) => p.latitude).reduce((a, b) => a + b) /
                points.length,
            points.map((p) => p.longitude).reduce((a, b) => a + b) /
                points.length,
          );
    return LayoutBuilder(
      builder: (context, constraints) {
        final size = constraints.biggest;
        if (size != _size) {
          _size = size;
          _framed = null;
          WidgetsBinding.instance.addPostFrameCallback((_) => _sync());
        }
        return kakao.KakaoMap(
          option: kakao.KakaoMapOption(position: center, zoomLevel: 14),
          onMapReady: _ready,
          onMapError: (error) {
            debugPrint('카카오 지도를 띄우지 못해 그림 지도로 그려요: $error');
            if (mounted) setState(() => _failed = true);
          },
        );
      },
    );
  }
}
