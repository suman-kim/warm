import { InvalidArgumentError } from '../../../common/domain/domain-error.js';

export interface SavedAddressInput {
  label: string;
  address: string;
  detailAddress?: string | null;
  sigungu?: string | null;
  dong?: string | null;
  latitude: number;
  longitude: number;
}

/** 회원마다 둘 수 있는 주소 수. */
export const MAX_SAVED_ADDRESSES = 20;

/** 자주 쓰는 주소. 회원이 이름을 붙여 저장해 두고 배송을 요청할 때 불러 쓴다. */
export class SavedAddress {
  constructor(
    readonly id: string,
    readonly userId: string,
    /** 회원이 붙인 이름 (예: 역삼 사무실) */
    readonly label: string,
    readonly address: string,
    readonly detailAddress: string | null,
    readonly sigungu: string | null,
    readonly dong: string | null,
    readonly latitude: number,
    readonly longitude: number,
    readonly createdAt: Date,
  ) {}

  static create(
    id: string,
    userId: string,
    input: SavedAddressInput,
    createdAt: Date,
  ): SavedAddress {
    const label = input.label.trim();
    const address = input.address.trim();
    if (label.length < 1 || label.length > 30) {
      throw new InvalidArgumentError(
        'INVALID_ADDRESS_LABEL',
        '주소 이름은 1~30자로 입력해 주세요.',
      );
    }
    if (address.length < 1 || address.length > 200) {
      throw new InvalidArgumentError(
        'INVALID_ADDRESS',
        '주소를 1~200자로 입력해 주세요.',
      );
    }
    if (
      !Number.isFinite(input.latitude) ||
      !Number.isFinite(input.longitude) ||
      Math.abs(input.latitude) > 90 ||
      Math.abs(input.longitude) > 180
    ) {
      throw new InvalidArgumentError(
        'INVALID_COORDINATES',
        '좌표가 올바르지 않아요.',
      );
    }
    return new SavedAddress(
      id,
      userId,
      label,
      address,
      input.detailAddress?.trim() || null,
      input.sigungu?.trim() || null,
      input.dong?.trim() || null,
      input.latitude,
      input.longitude,
      createdAt,
    );
  }
}

/** 자주 쓰는 주소 저장소 DI 토큰. */
export const SAVED_ADDRESS_REPOSITORY = Symbol('SAVED_ADDRESS_REPOSITORY');

/** 자주 쓰는 주소 저장소 계약. */
export interface SavedAddressRepository {
  save(address: SavedAddress): Promise<void>;
  /** 저장한 순서대로. */
  findByUser(userId: string): Promise<SavedAddress[]>;
  findOne(userId: string, id: string): Promise<SavedAddress | null>;
  countByUser(userId: string): Promise<number>;
  delete(userId: string, id: string): Promise<void>;
  /** 회원의 주소를 모두 지운다 (탈퇴). */
  deleteByUser(userId: string): Promise<void>;
}
