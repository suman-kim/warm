import 'package:flutter_test/flutter_test.dart';
import 'package:kakao_flutter_sdk_navi/kakao_flutter_sdk_navi.dart' as kakao;
import 'package:movo_api/movo_api.dart';
import 'package:movo_driver/services.dart';

void main() {
  test('카카오내비 차종 — 오토바이는 이륜차(고속도로를 피한다), 다마스·라보는 경차, 트럭은 크기대로', () {
    expect(naviVehicleOf(VehicleType.motorcycle), kakao.VehicleType.twoWheel);
    expect(naviVehicleOf(VehicleType.damas), kakao.VehicleType.sixth);
    expect(naviVehicleOf(VehicleType.labo), kakao.VehicleType.sixth);
    expect(naviVehicleOf(VehicleType.truck1Ton), kakao.VehicleType.first);
    expect(naviVehicleOf(VehicleType.truck2HalfTon), kakao.VehicleType.second);
    expect(naviVehicleOf(VehicleType.truck5Ton), kakao.VehicleType.third);
    expect(naviVehicleOf(VehicleType.unknown), isNull);
  });
}
