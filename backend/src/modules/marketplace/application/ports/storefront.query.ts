import { Storefront } from '../../domain/entities/storefront.entity.js';

/** 손님 주소 근처 가게 조회 DI 토큰. */
export const STOREFRONT_QUERY = Symbol('STOREFRONT_QUERY');

export interface NearbyStorefrontFilter {
  latitude: number;
  longitude: number;
  category?: string;
  /** 가게 이름이나 메뉴 이름 */
  q?: string;
}

export interface NearbyStorefront {
  storefront: Storefront;
  storeName: string;
  /** 손님 주소에서 직선 거리 (km) */
  distanceKm: number;
}

/** 가게 목록 조회. 승인됐고 운영자가 내리지 않았으며 보이는 메뉴가 있는 가게만 준다. */
export interface StorefrontQuery {
  /** 손님 주소가 가게의 배달 거리 안에 드는 가게 */
  nearby(filter: NearbyStorefrontFilter): Promise<NearbyStorefront[]>;
}
