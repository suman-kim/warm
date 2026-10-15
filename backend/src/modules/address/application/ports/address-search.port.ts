/** 주소 검색 DI 토큰. */
export const ADDRESS_SEARCH = Symbol('ADDRESS_SEARCH');

/** 검색으로 찾은 한 곳. 고르면 그대로 주문의 출발지·도착지나 자주 쓰는 주소가 된다. */
export class FoundAddressResult {
  /** 도로명 주소 (없으면 지번 주소). @example 서울 강남구 테헤란로 152 */
  address: string;
  /** 건물이나 장소 이름. @example 강남파이낸스센터 */
  detail: string | null;
  /** 시·군·구. 수락 전 기사에게는 구·동까지만 보인다. @example 강남구 */
  sigungu: string | null;
  /** 법정동(읍·면). @example 역삼동 */
  dong: string | null;
  latitude: number;
  longitude: number;
}

/** 검색어로 주소와 장소를 찾는 포트. 구현은 카카오 로컬 API, 키가 없으면 견본 주소. */
export interface AddressSearch {
  /** 주소(도로명·지번)와 장소 이름으로 찾는다. 주소로 찾은 것이 앞에 온다. */
  search(query: string): Promise<FoundAddressResult[]>;
}
