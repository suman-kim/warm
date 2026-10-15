import { InvalidArgumentError } from '../../../../common/domain/domain-error.js';
import { Waypoint, WaypointInput } from './waypoint.js';

const INPUT: WaypointInput = {
  address: ' 서울 성동구 성수이로 113 ',
  detailAddress: ' 1층 정문 ',
  sigungu: '성동구',
  dong: '성수동2가',
  latitude: 37.5445,
  longitude: 127.0557,
  contactName: ' 김지은 ',
  contactPhone: '010-1234-5678',
};

const waypoint = (overrides: Partial<WaypointInput> = {}) =>
  Waypoint.of({ ...INPUT, ...overrides });

describe('Waypoint', () => {
  it('앞뒤 공백을 떼고 연락처를 숫자만 남긴다', () => {
    expect(waypoint()).toMatchObject({
      address: '서울 성동구 성수이로 113',
      detailAddress: '1층 정문',
      contactName: '김지은',
      contactPhone: { value: '01012345678' },
    });
  });

  it('주소와 연락처 이름은 비울 수 없다', () => {
    expect(() => waypoint({ address: '  ' })).toThrow(InvalidArgumentError);
    expect(() => waypoint({ contactName: '' })).toThrow(InvalidArgumentError);
  });

  describe('area — 수락 전 기사에게 보이는 위치', () => {
    it('구와 동까지만 적는다', () => {
      expect(waypoint().area).toBe('성동구 성수동2가');
      expect(waypoint({ dong: null }).area).toBe('성동구');
    });

    it('구·동을 받지 못했으면 주소의 앞 두 마디만 쓴다 (도로명·번지는 감춘다)', () => {
      const area = waypoint({ sigungu: null, dong: ' ' }).area;

      expect(area).toBe('서울 성동구');
      expect(area).not.toContain('성수이로');
    });
  });
});
