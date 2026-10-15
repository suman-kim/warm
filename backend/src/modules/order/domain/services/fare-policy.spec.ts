import { VehicleType } from '../../../../common/domain/vehicle-type.js';
import { FarePolicy } from './fare-policy.js';

describe('FarePolicy', () => {
  it('기본 거리까지는 기본요금만 받는다', () => {
    expect(FarePolicy.quote(VehicleType.MOTORCYCLE, 0).amount).toBe(8000);
    expect(FarePolicy.quote(VehicleType.MOTORCYCLE, 5).amount).toBe(8000);
  });

  it('기본 거리를 넘으면 1km 단위로 올림해 더한다', () => {
    // 5km 초과분 0.1km → 1km로 올림
    expect(FarePolicy.quote(VehicleType.MOTORCYCLE, 5.1).amount).toBe(9000);
    // 5km 초과분 10.8km → 11km
    expect(FarePolicy.quote(VehicleType.DAMAS, 15.8).amount).toBe(33200);
  });

  it('모든 차종에 요금이 있다', () => {
    for (const vehicleType of Object.values(VehicleType)) {
      expect(FarePolicy.quote(vehicleType, 30).amount).toBeGreaterThan(0);
    }
  });
});
