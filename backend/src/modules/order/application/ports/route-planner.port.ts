import { GeoPoint } from '../../domain/value-objects/geo-point.js';

/** 경로 계획기 DI 토큰. */
export const ROUTE_PLANNER = Symbol('ROUTE_PLANNER');

export interface PlannedRoute {
  /** 운행 거리(km, 소수 첫째 자리) */
  distanceKm: number;
  /** 예상 소요 시간(분) */
  durationMinutes: number;
  /** 지도에 그릴 경로. 출발점에서 도착점까지 순서대로. */
  path: GeoPoint[];
}

/** 두 지점 사이의 운행 경로를 구하는 포트. 요금·도착 예정 시각·지도의 경로 선에 쓴다. */
export interface RoutePlanner {
  plan(from: GeoPoint, to: GeoPoint): Promise<PlannedRoute>;
}
