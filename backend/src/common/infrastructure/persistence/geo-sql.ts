/**
 * 위도·경도 컬럼과 한 점 사이의 직선 거리(km)를 구하는 SQL (하버사인 공식). 점은 :lat, :lng 파라미터로 넘긴다.
 * PostGIS 없이 쓴다 — 대기 주문·운행 중 기사처럼 행이 적은 곳에서만 쓰고, 먼저 [boundingBox]로 좁힌다.
 */
export function distanceKmSql(latitude: string, longitude: string): string {
  return `(6371 * 2 * ASIN(SQRT(
    POWER(SIN(RADIANS(${latitude} - :lat) / 2), 2) +
    COS(RADIANS(:lat)) * COS(RADIANS(${latitude})) *
    POWER(SIN(RADIANS(${longitude} - :lng) / 2), 2)
  )))`;
}

/** 한 점에서 [radiusKm] 안을 덮는 위도·경도 범위. 인덱스로 먼저 좁히는 데 쓴다. */
export function boundingBox(
  latitude: number,
  longitude: number,
  radiusKm: number,
): { minLat: number; maxLat: number; minLng: number; maxLng: number } {
  const latSpan = radiusKm / 111.32;
  const lngSpan =
    radiusKm / (111.32 * Math.max(0.01, Math.cos((latitude * Math.PI) / 180)));
  return {
    minLat: latitude - latSpan,
    maxLat: latitude + latSpan,
    minLng: longitude - lngSpan,
    maxLng: longitude + lngSpan,
  };
}
