import { Logger } from '@nestjs/common';
import { UnavailableError } from '../../../../common/domain/domain-error.js';
import {
  AddressSearch,
  FoundAddressResult,
} from '../../application/ports/address-search.port.js';

const BASE_URL = 'https://dapi.kakao.com/v2/local';
const TIMEOUT_MS = 5_000;
/** 주소 검색과 키워드 검색에서 각각 받는 수. 합쳐서 중복을 빼고 [LIMIT]개까지 준다. */
const PAGE_SIZE = 10;
const LIMIT = 15;

interface KakaoRegion {
  address_name: string;
  region_2depth_name: string;
  region_3depth_name: string;
}

interface KakaoAddressDocument {
  /** REGION(동까지만) | ROAD(길 이름만) | REGION_ADDR(지번) | ROAD_ADDR(도로명) */
  address_type: string;
  address: KakaoRegion | null;
  road_address: (KakaoRegion & { building_name: string }) | null;
  x: string;
  y: string;
}

interface KakaoKeywordDocument {
  place_name: string;
  /** 지번 주소 (예: 서울 송파구 신천동 29) */
  address_name: string;
  road_address_name: string;
  x: string;
  y: string;
}

/**
 * 카카오 로컬 API로 찾는다. 주소 검색과 키워드(장소 이름) 검색을 함께 불러 합친다.
 * REST API 키는 서버에만 둔다 — 앱에 넣으면 꺼내 쓸 수 있다.
 */
export class KakaoLocalAddressSearch implements AddressSearch {
  private readonly logger = new Logger(KakaoLocalAddressSearch.name);

  constructor(private readonly restApiKey: string) {}

  async search(query: string): Promise<FoundAddressResult[]> {
    const [addresses, places] = await Promise.all([
      this.get<KakaoAddressDocument>('search/address.json', query),
      this.get<KakaoKeywordDocument>('search/keyword.json', query),
    ]);
    const found = [
      // 번지·건물 번호까지 있는 주소만 — 동이나 길 이름만으로는 배송지가 되지 않는다.
      ...addresses
        .filter((doc) => doc.address_type.endsWith('_ADDR'))
        .map(fromAddress),
      ...places.map(fromKeyword),
    ];
    const seen = new Set<string>();
    return found
      .filter((place) => {
        const key = `${place.address}|${place.detail ?? ''}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, LIMIT);
  }

  private async get<T>(path: string, query: string): Promise<T[]> {
    const url = `${BASE_URL}/${path}?${new URLSearchParams({ query, size: String(PAGE_SIZE) })}`;
    let response: Response;
    try {
      response = await fetch(url, {
        headers: { Authorization: `KakaoAK ${this.restApiKey}` },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (error) {
      this.logger.warn(`카카오 로컬 API에 닿지 못했어요: ${String(error)}`);
      throw unavailable();
    }
    if (!response.ok) {
      // 401·403은 키가 틀렸거나 카카오맵 API를 켜지 않은 것, 429는 한도를 넘은 것이다.
      this.logger.error(
        `카카오 로컬 API ${path} → ${response.status} ${await response.text()}`,
      );
      throw unavailable();
    }
    return ((await response.json()) as { documents: T[] }).documents;
  }
}

function unavailable(): UnavailableError {
  return new UnavailableError(
    'ADDRESS_SEARCH_UNAVAILABLE',
    '주소 검색이 잠시 안 돼요. 잠시 뒤 다시 해 주세요.',
  );
}

function fromAddress(doc: KakaoAddressDocument): FoundAddressResult {
  const road = doc.road_address;
  const region = doc.address ?? road;
  return {
    address: road?.address_name || doc.address?.address_name || '',
    detail: road?.building_name || null,
    sigungu: region?.region_2depth_name || null,
    dong: region?.region_3depth_name || null,
    latitude: Number(doc.y),
    longitude: Number(doc.x),
  };
}

function fromKeyword(doc: KakaoKeywordDocument): FoundAddressResult {
  return {
    address: doc.road_address_name || doc.address_name,
    detail: doc.place_name || null,
    ...regionOf(doc.address_name),
    latitude: Number(doc.y),
    longitude: Number(doc.x),
  };
}

/**
 * 지번 주소에서 시·군·구와 동을 나눈다. 키워드 검색 결과에는 행정구역이 따로 오지 않는다.
 *   서울 송파구 신천동 29        → 송파구 · 신천동
 *   경기 성남시 분당구 백현동 532 → 성남시 분당구 · 백현동
 *   세종특별자치시 한솔동 960     → null · 한솔동
 */
export function regionOf(jibunAddress: string): {
  sigungu: string | null;
  dong: string | null;
} {
  const words = jibunAddress.trim().split(/\s+/);
  const at = words.findIndex(
    (word, index) => index > 0 && /(동|읍|면|가|리)$/.test(word),
  );
  if (at < 0) return { sigungu: words[1] ?? null, dong: null };
  return { sigungu: words.slice(1, at).join(' ') || null, dong: words[at] };
}
