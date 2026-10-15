import { VehicleType } from './vehicle-type.js';

/**
 * 배차 반경(km). 기사의 마지막 위치에서 픽업지까지 직선 거리로 잰다 — 이 안의 주문만 대기 목록에 보이고,
 * 새 주문 푸시도 이 안의 기사에게만 간다. 큰 차일수록 멀리서도 받는다.
 * TODO: 임시 값이다. 실제 운행 데이터를 보고 정한다 (작업 14.4). 아무도 수락하지 않을 때 반경을 넓힐지는 작업 17.
 */
export const DISPATCH_RADIUS_KM: Readonly<Record<VehicleType, number>> = {
  [VehicleType.MOTORCYCLE]: 5,
  [VehicleType.DAMAS]: 10,
  [VehicleType.LABO]: 10,
  [VehicleType.TRUCK_1T]: 15,
  [VehicleType.TRUCK_2_5T]: 20,
  [VehicleType.TRUCK_5T]: 30,
};

/**
 * 이보다 오래된 기사 위치는 모르는 것으로 본다. 기사 앱은 운행 중에 15초마다 위치를 보낸다 —
 * 오래됐다면 앱이 꺼졌거나 위치 권한이 없다.
 */
export const DRIVER_LOCATION_FRESH_MS = 10 * 60_000;

/** [now] 기준으로 이 시각 뒤에 보낸 위치만 믿는다. */
export function freshLocationSince(now: Date): Date {
  return new Date(now.getTime() - DRIVER_LOCATION_FRESH_MS);
}
