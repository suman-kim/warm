import { VehicleType } from '../../../../common/domain/vehicle-type.js';
import { Money } from '../value-objects/money.js';

interface FareRate {
  /** 기본요금(원). 기본 거리까지는 이 금액만 낸다. */
  baseFare: number;
  baseDistanceKm: number;
  /** 기본 거리를 넘은 1km마다 더하는 금액(원) */
  perKmFare: number;
}

// TODO: 임시 요금표다. 서비스 요금 정책이 정해지면 이 값을 바꾼다.
const FARE_RATES: Readonly<Record<VehicleType, FareRate>> = {
  [VehicleType.MOTORCYCLE]: {
    baseFare: 8000,
    baseDistanceKm: 5,
    perKmFare: 1000,
  },
  [VehicleType.DAMAS]: { baseFare: 20000, baseDistanceKm: 5, perKmFare: 1200 },
  [VehicleType.LABO]: { baseFare: 25000, baseDistanceKm: 5, perKmFare: 1300 },
  [VehicleType.TRUCK_1T]: {
    baseFare: 40000,
    baseDistanceKm: 10,
    perKmFare: 1500,
  },
  [VehicleType.TRUCK_2_5T]: {
    baseFare: 70000,
    baseDistanceKm: 10,
    perKmFare: 2000,
  },
  // 1톤·2.5톤의 흐름에 맞춘 임시값.
  [VehicleType.TRUCK_5T]: {
    baseFare: 120000,
    baseDistanceKm: 10,
    perKmFare: 2800,
  },
};

/**
 * 요금 정책 (도메인 서비스).
 * 차종별 기본요금에, 기본 거리를 넘은 거리를 1km 단위로 올림해 더한다.
 */
export class FarePolicy {
  static quote(vehicleType: VehicleType, distanceKm: number): Money {
    const rate = FARE_RATES[vehicleType];
    const extraKm = Math.ceil(Math.max(0, distanceKm - rate.baseDistanceKm));
    return Money.won(rate.baseFare + extraKm * rate.perKmFare);
  }
}
