import { UnavailableError } from '../../../../common/domain/domain-error.js';
import {
  KakaoLocalAddressSearch,
  regionOf,
} from './kakao-local.address-search.js';

// 카카오 로컬 API가 실제로 보내는 모양 (2026-10-14에 받은 응답에서 필요한 필드만).
const ADDRESS_RESPONSE = {
  documents: [
    {
      address_name: '서울 강남구 테헤란로 152',
      address_type: 'ROAD_ADDR',
      address: {
        address_name: '서울 강남구 역삼동 737',
        region_1depth_name: '서울',
        region_2depth_name: '강남구',
        region_3depth_h_name: '역삼1동',
        region_3depth_name: '역삼동',
      },
      road_address: {
        address_name: '서울 강남구 테헤란로 152',
        building_name: '강남파이낸스센터',
        region_2depth_name: '강남구',
        region_3depth_name: '역삼동',
      },
      x: '127.036508620542',
      y: '37.5000242405515',
    },
    {
      // 동 이름만 — 배송지가 될 수 없어 뺀다.
      address_name: '서울 강남구 역삼동',
      address_type: 'REGION',
      address: {
        address_name: '서울 강남구 역삼동',
        region_2depth_name: '강남구',
        region_3depth_name: '역삼동',
      },
      road_address: null,
      x: '127.03',
      y: '37.49',
    },
  ],
};
const KEYWORD_RESPONSE = {
  documents: [
    {
      place_name: '롯데월드타워',
      address_name: '서울 송파구 신천동 29',
      road_address_name: '서울 송파구 올림픽로 300',
      x: '127.10255558658325',
      y: '37.51260447840551',
    },
    {
      // 주소 검색 결과와 같은 곳 — 한 번만 준다.
      place_name: '강남파이낸스센터',
      address_name: '서울 강남구 역삼동 737',
      road_address_name: '서울 강남구 테헤란로 152',
      x: '127.036508620542',
      y: '37.5000242405515',
    },
  ],
};

function stubFetch(
  respond: (url: URL) => { status: number; body: unknown } | Error,
) {
  const calls: { url: URL; headers: HeadersInit | undefined }[] = [];
  vi.stubGlobal('fetch', (input: string, init?: RequestInit) => {
    const url = new URL(input);
    calls.push({ url, headers: init?.headers });
    const result = respond(url);
    if (result instanceof Error) return Promise.reject(result);
    return Promise.resolve(
      new Response(JSON.stringify(result.body), { status: result.status }),
    );
  });
  return calls;
}

describe('KakaoLocalAddressSearch', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('주소 검색과 키워드 검색을 합친다 — 주소가 앞, 같은 곳은 한 번, 동만 있는 결과는 뺀다', async () => {
    const calls = stubFetch((url) => ({
      status: 200,
      body: url.pathname.endsWith('address.json')
        ? ADDRESS_RESPONSE
        : KEYWORD_RESPONSE,
    }));

    const found = await new KakaoLocalAddressSearch('rest-key').search(
      '테헤란로 152',
    );

    expect(found).toEqual([
      {
        address: '서울 강남구 테헤란로 152',
        detail: '강남파이낸스센터',
        sigungu: '강남구',
        dong: '역삼동',
        latitude: 37.5000242405515,
        longitude: 127.036508620542,
      },
      {
        address: '서울 송파구 올림픽로 300',
        detail: '롯데월드타워',
        sigungu: '송파구',
        dong: '신천동',
        latitude: 37.51260447840551,
        longitude: 127.10255558658325,
      },
    ]);
    expect(calls.map((call) => call.url.pathname).sort()).toEqual([
      '/v2/local/search/address.json',
      '/v2/local/search/keyword.json',
    ]);
    expect(calls[0].url.searchParams.get('query')).toBe('테헤란로 152');
    expect(calls[0].headers).toEqual({ Authorization: 'KakaoAK rest-key' });
  });

  it('카카오가 거절하거나 닿지 않으면 503으로 알린다', async () => {
    stubFetch(() => ({
      status: 401,
      body: { errorType: 'AccessDeniedError' },
    }));
    await expect(
      new KakaoLocalAddressSearch('wrong').search('테헤란로'),
    ).rejects.toMatchObject({
      constructor: UnavailableError,
      code: 'ADDRESS_SEARCH_UNAVAILABLE',
    });

    stubFetch(() => new TypeError('fetch failed'));
    await expect(
      new KakaoLocalAddressSearch('rest-key').search('테헤란로'),
    ).rejects.toBeInstanceOf(UnavailableError);
  });
});

describe('regionOf — 지번 주소에서 구·동 나누기', () => {
  it.each([
    ['서울 송파구 신천동 29', '송파구', '신천동'],
    ['서울 성동구 성수동2가 273-1', '성동구', '성수동2가'],
    ['경기 성남시 분당구 백현동 532', '성남시 분당구', '백현동'],
    ['경기 양평군 양평읍 양근리 123', '양평군', '양평읍'],
    ['세종특별자치시 한솔동 960', null, '한솔동'],
  ])('%s → %s · %s', (address, sigungu, dong) => {
    expect(regionOf(address)).toEqual({ sigungu, dong });
  });
});
