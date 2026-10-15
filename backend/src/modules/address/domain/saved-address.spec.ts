import { InvalidArgumentError } from '../../../common/domain/domain-error.js';
import { SavedAddress, SavedAddressInput } from './saved-address.js';

const NOW = new Date('2026-10-13T09:00:00Z');
const INPUT: SavedAddressInput = {
  label: ' 역삼 사무실 ',
  address: ' 서울 강남구 테헤란로 152 ',
  detailAddress: '  ',
  sigungu: '강남구',
  dong: '역삼동',
  latitude: 37.5,
  longitude: 127.03,
};

const create = (overrides: Partial<SavedAddressInput> = {}) =>
  SavedAddress.create('address-1', 'user-1', { ...INPUT, ...overrides }, NOW);

describe('SavedAddress', () => {
  it('앞뒤 공백을 떼고, 빈 값은 null로 둔다', () => {
    expect(create()).toMatchObject({
      label: '역삼 사무실',
      address: '서울 강남구 테헤란로 152',
      detailAddress: null,
      sigungu: '강남구',
    });
  });

  it('이름은 1~30자다', () => {
    expect(() => create({ label: '  ' })).toThrow(InvalidArgumentError);
    expect(() => create({ label: '가'.repeat(31) })).toThrow(
      InvalidArgumentError,
    );
    expect(() => create({ label: '가'.repeat(30) })).not.toThrow();
  });

  it('주소가 비면 거절한다', () => {
    expect(() => create({ address: ' ' })).toThrow(InvalidArgumentError);
  });

  it('좌표가 범위를 벗어나면 거절한다', () => {
    expect(() => create({ latitude: 91 })).toThrow(InvalidArgumentError);
    expect(() => create({ longitude: -181 })).toThrow(InvalidArgumentError);
    expect(() => create({ latitude: Number.NaN })).toThrow(
      InvalidArgumentError,
    );
  });
});
