/**
 * 배차 반경(km). 라이더의 마지막 위치에서 가게(픽업지)까지 직선 거리로 잰다 — 이 안의 배달만 콜 목록에 보이고,
 * 새 콜 푸시도 이 안의 라이더에게만 간다.
 * TODO: 임시 값이다. 실제 운행 데이터를 보고 정한다 (작업 14.4). 아무도 수락하지 않을 때 반경을 넓힐지는 작업 17.
 */
export const DISPATCH_RADIUS_KM = 5;

/**
 * 이보다 오래된 기사 위치는 모르는 것으로 본다. 기사 앱은 운행 중에 15초마다 위치를 보낸다 —
 * 오래됐다면 앱이 꺼졌거나 위치 권한이 없다.
 */
export const DRIVER_LOCATION_FRESH_MS = 10 * 60_000;

/**
 * 라이더 한 명이 동시에 맡을 수 있는 배달 수 (묶음배송).
 * TODO: 임시 값이다. 운영하며 정한다 (작업 35.5).
 */
export const MAX_ACTIVE_DELIVERIES = 3;

/** [now] 기준으로 이 시각 뒤에 보낸 위치만 믿는다. */
export function freshLocationSince(now: Date): Date {
  return new Date(now.getTime() - DRIVER_LOCATION_FRESH_MS);
}
