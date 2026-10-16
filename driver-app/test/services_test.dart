import 'package:flutter_test/flutter_test.dart';
import 'package:kakao_flutter_sdk_navi/kakao_flutter_sdk_navi.dart' as kakao;
import 'package:movo_api/movo_api.dart';
import 'package:movo_driver/services.dart';

void main() {
  test('카카오내비 차종 — 오토바이는 이륜차로 안내한다 (고속도로를 피한다)', () {
    expect(naviVehicleOf(VehicleType.motorcycle), kakao.VehicleType.twoWheel);
    expect(naviVehicleOf(VehicleType.unknown), isNull);
  });
}
