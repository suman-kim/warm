import 'dart:io' show Platform;

import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:image_picker/image_picker.dart';
import 'package:kakao_flutter_sdk_navi/kakao_flutter_sdk_navi.dart' as kakao;
import 'package:movo_api/movo_api.dart';
import 'package:movo_ui/movo_ui.dart';

/// 기기에서 서류 사진을 고른다.
abstract interface class DocumentPicker {
  /// 고르지 않고 닫았으면 null.
  Future<UploadFile?> pick(BuildContext context);
}

/// 기기의 지금 위치.
abstract interface class LocationSource {
  /// 권한이 없거나 위치를 알 수 없으면 null.
  Future<Coordinates?> current();

  /// 위치가 바뀔 때마다 알린다. 듣는 동안은 앱이 뒤로 가도 위치를 받는다
  /// (안드로이드는 알림을 띄운 포그라운드 서비스, iOS는 백그라운드 위치 모드).
  /// 권한이 없으면 아무것도 보내지 않고 끝난다.
  Stream<Coordinates> watch();
}

/// 목적지까지 길안내를 여는 곳.
abstract interface class RouteGuide {
  /// 길안내를 열었으면 true.
  Future<bool> open(
    BuildContext context, {
    required Coordinates destination,
    required String label,
    required VehicleType vehicleType,
  });
}

/// 이 앱이 쓰는 구현. 테스트에서는 가짜로 바꿔 끼운다.
DocumentPicker documentPicker = const DevicePhotoPicker();
LocationSource locationSource = const DeviceLocation();
RouteGuide routeGuide = const KakaoNaviGuide();

/// 카메라로 찍거나 앨범에서 고른다.
class DevicePhotoPicker implements DocumentPicker {
  const DevicePhotoPicker();

  @override
  Future<UploadFile?> pick(BuildContext context) async {
    final source = await showModalBottomSheet<ImageSource>(
      context: context,
      backgroundColor: Colors.transparent,
      barrierColor: context.colors.scrim,
      builder: (context) => const _SourceSheet(),
    );
    if (source == null) return null;
    try {
      final picked = await ImagePicker().pickImage(
        source: source,
        // 서버는 10MB까지 받는다. 서류 글자가 읽힐 만큼만 남기고 줄인다.
        maxWidth: 2400,
        maxHeight: 2400,
        imageQuality: 85,
      );
      if (picked == null) return null;
      return UploadFile(
        bytes: await picked.readAsBytes(),
        filename: picked.name,
      );
    } on Object {
      if (context.mounted) {
        showMovoToast(context, '사진을 가져오지 못했어요. 권한을 확인해 주세요.');
      }
      return null;
    }
  }
}

class _SourceSheet extends StatelessWidget {
  const _SourceSheet();

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Container(
      padding: EdgeInsets.fromLTRB(
        20,
        12,
        20,
        MediaQuery.paddingOf(context).bottom + 16,
      ),
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(30)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const MovoSheetHandle(),
          const SizedBox(height: 20),
          Text('사진 올리기', style: mv(20, 800, ls: -0.02)),
          const SizedBox(height: 8),
          MovoMenuRow(
            '카메라로 찍기',
            onTap: () => Navigator.of(context).pop(ImageSource.camera),
          ),
          MovoMenuRow(
            '앨범에서 고르기',
            onTap: () => Navigator.of(context).pop(ImageSource.gallery),
          ),
        ],
      ),
    );
  }
}

/// 기기의 위치 서비스. 앱을 쓰는 동안의 위치 권한을 요청한다.
class DeviceLocation implements LocationSource {
  const DeviceLocation();

  /// 위치를 쓸 수 있는지. 권한이 없으면 한 번 요청한다.
  static Future<bool> _allowed() async {
    if (!await Geolocator.isLocationServiceEnabled()) return false;
    var permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
    }
    return permission == LocationPermission.whileInUse ||
        permission == LocationPermission.always;
  }

  @override
  Stream<Coordinates> watch() async* {
    try {
      if (!await _allowed()) return;
    } on Object {
      return;
    }
    const distanceFilter = 20;
    final settings = Platform.isAndroid
        ? AndroidSettings(
            accuracy: LocationAccuracy.high,
            distanceFilter: distanceFilter,
            intervalDuration: const Duration(seconds: 10),
            // 운행 중 알림. 이 알림이 떠 있는 동안 길안내 앱으로 넘어가도 위치를 받는다.
            foregroundNotificationConfig: const ForegroundNotificationConfig(
              notificationTitle: 'MOVO 운행 중',
              notificationText: '운행을 끄기 전까지 가게에 배달 위치를 알려요.',
              notificationChannelName: '운행 중 위치',
              notificationIcon: AndroidResource(
                name: 'ic_launcher',
                defType: 'mipmap',
              ),
              setOngoing: true,
            ),
          )
        : Platform.isIOS
        ? AppleSettings(
            accuracy: LocationAccuracy.high,
            activityType: ActivityType.automotiveNavigation,
            distanceFilter: distanceFilter,
            pauseLocationUpdatesAutomatically: false,
            allowBackgroundLocationUpdates: true,
            showBackgroundLocationIndicator: true,
          )
        : const LocationSettings(
            accuracy: LocationAccuracy.high,
            distanceFilter: distanceFilter,
          );
    yield* Geolocator.getPositionStream(locationSettings: settings)
        .handleError((Object _) {})
        .map(
          (position) => Coordinates(
            latitude: position.latitude,
            longitude: position.longitude,
          ),
        );
  }

  @override
  Future<Coordinates?> current() async {
    try {
      if (!await _allowed()) return null;
      final position = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.high,
          timeLimit: Duration(seconds: 8),
        ),
      );
      return Coordinates(
        latitude: position.latitude,
        longitude: position.longitude,
      );
    } on Object {
      return null;
    }
  }
}

/// 카카오내비로 길안내를 연다. 카카오내비가 없거나 열지 못하면 기기의 지도 앱(티맵·네이버지도 등)으로 연다.
class KakaoNaviGuide implements RouteGuide {
  const KakaoNaviGuide();

  static bool _ready = false;

  /// 앱 키로 카카오 SDK를 준비한다. 키가 없으면 늘 기기의 지도 앱으로 연다.
  static Future<void> initialize(String appKey) async {
    if (appKey.isEmpty || !(Platform.isAndroid || Platform.isIOS)) return;
    try {
      await kakao.KakaoSdk.init(nativeAppKey: appKey);
      _ready = true;
    } on Object catch (error) {
      debugPrint('카카오내비를 쓰지 못해 기기의 지도 앱으로 길안내해요: $error');
    }
  }

  @override
  Future<bool> open(
    BuildContext context, {
    required Coordinates destination,
    required String label,
    required VehicleType vehicleType,
  }) async {
    final launcher = context.launcher;
    if (_ready) {
      try {
        if (await kakao.NaviApi.instance.isKakaoNaviInstalled()) {
          await kakao.NaviApi.instance.navigate(
            destination: kakao.Location(
              name: label,
              x: '${destination.longitude}',
              y: '${destination.latitude}',
            ),
            option: kakao.NaviOption(
              coordType: kakao.CoordType.wgs84,
              vehicleType: naviVehicleOf(vehicleType),
            ),
          );
          return true;
        }
      } on Object catch (error) {
        debugPrint('카카오내비를 열지 못했어요: $error');
      }
    }
    return launcher.open(navigationUri(destination, label));
  }
}

/// 카카오내비의 차종(통행료·경로 구분). 이륜차는 고속도로·자동차 전용도로를 피한다.
kakao.VehicleType? naviVehicleOf(VehicleType type) => switch (type) {
  VehicleType.motorcycle => kakao.VehicleType.twoWheel,
  VehicleType.unknown => null,
};

/// 목적지로 가는 길안내를 기기의 지도 앱에서 연다 (카카오내비가 없을 때).
Uri navigationUri(Coordinates destination, String label) {
  final point = '${destination.latitude},${destination.longitude}';
  return Platform.isIOS
      ? Uri.parse('https://maps.apple.com/?daddr=$point&dirflg=d')
      : Uri.parse('geo:$point?q=$point(${Uri.encodeComponent(label)})');
}
