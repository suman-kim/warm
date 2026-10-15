import { InvalidArgumentError } from '../../../../common/domain/domain-error.js';

const EARTH_RADIUS_KM = 6371;

/** 위경도 좌표 값 객체 (WGS84). */
export class GeoPoint {
  private constructor(
    readonly latitude: number,
    readonly longitude: number,
  ) {}

  static of(latitude: number, longitude: number): GeoPoint {
    if (
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      Math.abs(latitude) > 90 ||
      Math.abs(longitude) > 180
    ) {
      throw new InvalidArgumentError(
        'INVALID_COORDINATES',
        '좌표가 올바르지 않아요.',
      );
    }
    return new GeoPoint(latitude, longitude);
  }

  /** 다른 지점까지의 직선 거리(km). 도로를 따라가는 거리는 이보다 길다. */
  straightDistanceKmTo(other: GeoPoint): number {
    const dLat = toRadians(other.latitude - this.latitude);
    const dLng = toRadians(other.longitude - this.longitude);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRadians(this.latitude)) *
        Math.cos(toRadians(other.latitude)) *
        Math.sin(dLng / 2) ** 2;
    return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(a));
  }
}

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}
