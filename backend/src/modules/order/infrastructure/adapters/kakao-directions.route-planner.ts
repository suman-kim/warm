import { Logger } from '@nestjs/common';
import {
  PlannedRoute,
  RoutePlanner,
} from '../../application/ports/route-planner.port.js';
import { GeoPoint } from '../../domain/value-objects/geo-point.js';

const URL = 'https://apis-navi.kakaomobility.com/v1/directions';
const TIMEOUT_MS = 5_000;

/** 지도에 넘기는 경로 점의 최대 개수. 길찾기 응답은 수백~수천 점이라 고르게 솎는다. */
const MAX_PATH_POINTS = 300;

/** 같은 구간(좌표 소수 넷째 자리 ≈ 11m)은 이 시간 동안 다시 묻지 않는다 — 추적·길안내는 몇 초마다 부른다. */
const CACHE_TTL_MS = 2 * 60_000;
const CACHE_SIZE = 500;

interface KakaoDirections {
  routes: {
    result_code: number;
    result_msg: string;
    summary?: { distance: number; duration: number };
    sections?: { roads: { vertexes: number[] }[] }[];
  }[];
}

/**
 * 카카오모빌리티 길찾기(자동차)로 실제 도로의 거리·시간·경로를 구한다. 카카오 REST API 키를 쓴다.
 * 길찾기가 안 되면(키·한도·네트워크 문제, 너무 가까운 두 점 등) [fallback]의 어림값을 쓴다 —
 * 견적·주문이 길찾기 때문에 막히지 않는다.
 * 승용차 경로다 (이륜차 경로는 아직 고려하지 않는다).
 */
export class KakaoDirectionsRoutePlanner implements RoutePlanner {
  private readonly logger = new Logger(KakaoDirectionsRoutePlanner.name);
  private readonly cache = new Map<
    string,
    { at: number; route: PlannedRoute }
  >();

  constructor(
    private readonly restApiKey: string,
    private readonly fallback: RoutePlanner,
    private readonly now: () => number = Date.now,
  ) {}

  async plan(from: GeoPoint, to: GeoPoint): Promise<PlannedRoute> {
    const key = [from, to]
      .map((p) => `${p.latitude.toFixed(4)},${p.longitude.toFixed(4)}`)
      .join('>');
    const cached = this.cache.get(key);
    if (cached && this.now() - cached.at < CACHE_TTL_MS) return cached.route;

    const route = await this.directions(from, to);
    if (!route) return this.fallback.plan(from, to);
    this.cache.delete(key);
    this.cache.set(key, { at: this.now(), route });
    // 가장 오래된 것부터 버린다 (Map은 넣은 순서를 지킨다).
    while (this.cache.size > CACHE_SIZE) {
      this.cache.delete(this.cache.keys().next().value!);
    }
    return route;
  }

  private async directions(
    from: GeoPoint,
    to: GeoPoint,
  ): Promise<PlannedRoute | null> {
    // 카카오는 경도,위도 순서다.
    const query = new URLSearchParams({
      origin: `${from.longitude},${from.latitude}`,
      destination: `${to.longitude},${to.latitude}`,
      priority: 'RECOMMEND',
    });
    let body: KakaoDirections;
    try {
      const response = await fetch(`${URL}?${query}`, {
        headers: { Authorization: `KakaoAK ${this.restApiKey}` },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!response.ok) {
        // 401·403은 키가 틀렸거나 길찾기를 쓸 수 없는 앱, 429는 한도를 넘은 것이다.
        this.logger.warn(
          `카카오 길찾기 ${response.status} ${await response.text()} — 어림값을 써요`,
        );
        return null;
      }
      body = (await response.json()) as KakaoDirections;
    } catch (error) {
      this.logger.warn(
        `카카오 길찾기에 닿지 못했어요: ${String(error)} — 어림값을 써요`,
      );
      return null;
    }

    const [route] = body.routes ?? [];
    if (!route || route.result_code !== 0 || !route.summary) {
      // 104(출발지와 도착지가 5m 안) 같은 경우. 어림값으로 충분하다.
      this.logger.debug?.(`카카오 길찾기 결과 없음: ${route?.result_msg}`);
      return null;
    }
    const vertexes = (route.sections ?? []).flatMap((section) =>
      section.roads.flatMap((road) => road.vertexes),
    );
    const road: GeoPoint[] = [];
    for (let i = 0; i + 1 < vertexes.length; i += 2) {
      road.push(GeoPoint.of(vertexes[i + 1], vertexes[i]));
    }
    return {
      distanceKm: Math.round(route.summary.distance / 100) / 10,
      durationMinutes: Math.max(1, Math.ceil(route.summary.duration / 60)),
      // 길은 가까운 도로에서 시작하고 끝난다 — 표시와 이어지게 두 지점을 양끝에 붙인다.
      path: [from, ...thin(road, MAX_PATH_POINTS), to],
    };
  }
}

/** 점이 너무 많으면 고르게 솎는다 (처음과 끝은 남긴다). */
export function thin<T>(points: T[], max: number): T[] {
  if (points.length <= max) return points;
  const step = (points.length - 1) / (max - 1);
  return Array.from({ length: max }, (_, i) => points[Math.round(i * step)]);
}
