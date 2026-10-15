import {
  PlannedRoute,
  RoutePlanner,
} from '../../application/ports/route-planner.port.js';
import { GeoPoint } from '../../domain/value-objects/geo-point.js';
import {
  KakaoDirectionsRoutePlanner,
  thin,
} from './kakao-directions.route-planner.js';

const SEONGSU = GeoPoint.of(37.5445, 127.0557);
const GANGNAM = GeoPoint.of(37.5, 127.0364);

// 카카오모빌리티 길찾기가 실제로 보내는 모양 (2026-10-14에 받은 응답에서 필요한 필드만).
const OK = {
  routes: [
    {
      result_code: 0,
      result_msg: '길찾기 성공',
      summary: { distance: 7563, duration: 1020 },
      sections: [
        {
          roads: [
            { vertexes: [127.0556, 37.5446, 127.05, 37.53] },
            { vertexes: [127.045, 37.52, 127.0365, 37.5001] },
          ],
        },
      ],
    },
  ],
};

const ESTIMATE: PlannedRoute = {
  distanceKm: 6.6,
  durationMinutes: 26,
  path: [SEONGSU, GANGNAM],
};
const fallback: RoutePlanner = { plan: () => Promise.resolve(ESTIMATE) };

function stubFetch(respond: () => { status: number; body: unknown } | Error) {
  const urls: URL[] = [];
  vi.stubGlobal('fetch', (input: string) => {
    urls.push(new URL(input));
    const result = respond();
    if (result instanceof Error) return Promise.reject(result);
    return Promise.resolve(
      new Response(JSON.stringify(result.body), { status: result.status }),
    );
  });
  return urls;
}

describe('KakaoDirectionsRoutePlanner', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('도로 거리·시간과 경로를 쓰고, 경로 양끝에 두 지점을 붙인다', async () => {
    const urls = stubFetch(() => ({ status: 200, body: OK }));

    const route = await new KakaoDirectionsRoutePlanner('key', fallback).plan(
      SEONGSU,
      GANGNAM,
    );

    expect(route.distanceKm).toBe(7.6);
    expect(route.durationMinutes).toBe(17);
    expect(route.path).toHaveLength(6);
    expect(route.path[0]).toBe(SEONGSU);
    expect(route.path[1]).toEqual(GeoPoint.of(37.5446, 127.0556));
    expect(route.path.at(-1)).toBe(GANGNAM);
    // 카카오는 경도,위도 순서로 받는다.
    expect(urls[0].searchParams.get('origin')).toBe('127.0557,37.5445');
    expect(urls[0].searchParams.get('destination')).toBe('127.0364,37.5');
  });

  it('같은 구간은 잠깐 동안 다시 묻지 않는다', async () => {
    const urls = stubFetch(() => ({ status: 200, body: OK }));
    let now = 0;
    const planner = new KakaoDirectionsRoutePlanner('key', fallback, () => now);

    await planner.plan(SEONGSU, GANGNAM);
    now += 60_000;
    await planner.plan(SEONGSU, GANGNAM);
    expect(urls).toHaveLength(1);

    now += 2 * 60_000;
    await planner.plan(SEONGSU, GANGNAM);
    expect(urls).toHaveLength(2);
  });

  it('길찾기가 안 되면 어림값을 쓴다 (거절, 닿지 않음, 결과 없음)', async () => {
    const planner = () => new KakaoDirectionsRoutePlanner('key', fallback);

    stubFetch(() => ({ status: 429, body: { msg: 'limit' } }));
    expect(await planner().plan(SEONGSU, GANGNAM)).toBe(ESTIMATE);

    stubFetch(() => new TypeError('fetch failed'));
    expect(await planner().plan(SEONGSU, GANGNAM)).toBe(ESTIMATE);

    stubFetch(() => ({
      status: 200,
      body: { routes: [{ result_code: 104, result_msg: '너무 가까워요' }] },
    }));
    expect(await planner().plan(SEONGSU, GANGNAM)).toBe(ESTIMATE);
  });

  it('경로 점이 많으면 처음과 끝을 남기고 고르게 솎는다', () => {
    const points = Array.from({ length: 1000 }, (_, i) => i);
    const thinned = thin(points, 300);
    expect(thinned).toHaveLength(300);
    expect(thinned[0]).toBe(0);
    expect(thinned.at(-1)).toBe(999);
    expect(thin([1, 2, 3], 300)).toEqual([1, 2, 3]);
  });
});
