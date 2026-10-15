import { Injectable } from '@nestjs/common';
import {
  PlannedRoute,
  RoutePlanner,
} from '../../application/ports/route-planner.port.js';
import { GeoPoint } from '../../domain/value-objects/geo-point.js';

/** 직선 거리를 도로 거리로 어림하는 계수. */
const ROAD_FACTOR = 1.3;
/** 도심 운행을 어림하는 값: 1km에 3.5분, 출발·도착에 2분. */
const MINUTES_PER_KM = 3.5;
const FIXED_MINUTES = 2;

/**
 * 외부 API 없이 경로를 어림하는 기본 구현.
 * 거리는 직선 거리 × 보정 계수, 시간은 거리에 비례, 경로 선은 두 점을 잇는 직선이다.
 * 실제 도로 경로가 필요하면 길찾기 API(카카오모빌리티·티맵 등)를 부르는 구현체로 바꿔 끼운다.
 */
@Injectable()
export class EstimatedRoutePlanner implements RoutePlanner {
  plan(from: GeoPoint, to: GeoPoint): Promise<PlannedRoute> {
    const distanceKm =
      Math.round(from.straightDistanceKmTo(to) * ROAD_FACTOR * 10) / 10;
    return Promise.resolve({
      distanceKm,
      durationMinutes: Math.ceil(distanceKm * MINUTES_PER_KM + FIXED_MINUTES),
      path: [from, to],
    });
  }
}
