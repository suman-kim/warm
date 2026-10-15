import {
  AddressSearch,
  FoundAddressResult,
} from '../../application/ports/address-search.port.js';

const place = (
  address: string,
  detail: string | null,
  sigungu: string,
  dong: string,
  latitude: number,
  longitude: number,
): FoundAddressResult => ({
  address,
  detail,
  sigungu,
  dong,
  latitude,
  longitude,
});

const PLACES: FoundAddressResult[] = [
  place(
    '서울 성동구 성수이로 113',
    null,
    '성동구',
    '성수동2가',
    37.5445,
    127.0557,
  ),
  place(
    '서울 강남구 테헤란로 152',
    '강남파이낸스센터',
    '강남구',
    '역삼동',
    37.5,
    127.0364,
  ),
  place(
    '서울 강남구 테헤란로 151',
    null,
    '강남구',
    '역삼동',
    37.4995,
    127.0359,
  ),
  place(
    '서울 강남구 테헤란로15길 4',
    null,
    '강남구',
    '역삼동',
    37.5003,
    127.0338,
  ),
  place(
    '서울 마포구 양화로 45',
    '메세나폴리스',
    '마포구',
    '서교동',
    37.5502,
    126.9138,
  ),
  place(
    '서울 마포구 월드컵북로 396',
    '누리꿈스퀘어',
    '마포구',
    '상암동',
    37.5796,
    126.89,
  ),
  place(
    '서울 영등포구 여의대로 108',
    '파크원',
    '영등포구',
    '여의도동',
    37.5265,
    126.9285,
  ),
  place(
    '서울 송파구 올림픽로 300',
    '롯데월드타워',
    '송파구',
    '신천동',
    37.5126,
    127.1025,
  ),
  place(
    '서울 중구 세종대로 110',
    '서울시청',
    '중구',
    '태평로1가',
    37.5663,
    126.9779,
  ),
  place(
    '경기 성남시 분당구 판교역로 166',
    null,
    '성남시 분당구',
    '백현동',
    37.3948,
    127.1112,
  ),
  place(
    '경기 고양시 일산동구 정발산로 24',
    '웨스턴돔',
    '고양시 일산동구',
    '장항동',
    37.6557,
    126.7708,
  ),
];

/**
 * 카카오 키(KAKAO_REST_API_KEY)가 없을 때 쓰는 견본. 정해 둔 몇 곳에서만 찾는다 —
 * 키 없이 개발하거나 e2e 테스트를 돌릴 때 쓴다. 운영에서는 키가 없으면 서버가 뜨지 않는다.
 */
export class SampleAddressSearch implements AddressSearch {
  search(query: string): Promise<FoundAddressResult[]> {
    const words = query.split(/\s+/).filter(Boolean);
    const matches = (found: FoundAddressResult) => {
      const text =
        `${found.address} ${found.detail ?? ''} ${found.dong ?? ''}`.replaceAll(
          ' ',
          '',
        );
      return words.every((word) => text.includes(word));
    };
    return Promise.resolve(PLACES.filter(matches));
  }
}
