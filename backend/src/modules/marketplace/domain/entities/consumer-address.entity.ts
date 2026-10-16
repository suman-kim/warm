import { InvalidArgumentError } from '../../../../common/domain/domain-error.js';

/** 손님이 저장한 배달 주소. */
export interface ConsumerAddress {
  id: string;
  userId: string;
  /** 집, 회사 같은 이름 */
  label: string;
  address: string;
  detailAddress: string | null;
  sigungu: string | null;
  dong: string | null;
  latitude: number;
  longitude: number;
  isDefault: boolean;
  createdAt: Date;
}

/** 한 손님이 저장할 수 있는 주소 수 */
export const MAX_CONSUMER_ADDRESSES = 10;

export function consumerAddress(
  input: Omit<ConsumerAddress, 'label' | 'detailAddress'> & {
    label: string;
    detailAddress?: string | null;
  },
): ConsumerAddress {
  const label = input.label.trim();
  const address = input.address.trim();
  if (!label || label.length > 20) {
    throw new InvalidArgumentError(
      'INVALID_ADDRESS_LABEL',
      '주소 이름은 1~20자로 적어 주세요.',
    );
  }
  if (!address || address.length > 200) {
    throw new InvalidArgumentError(
      'INVALID_ADDRESS',
      '주소를 검색해서 골라 주세요.',
    );
  }
  if (
    !(Math.abs(input.latitude) <= 90) ||
    !(Math.abs(input.longitude) <= 180)
  ) {
    throw new InvalidArgumentError(
      'INVALID_ADDRESS',
      '주소의 위치가 올바르지 않아요.',
    );
  }
  const detailAddress = input.detailAddress?.trim() || null;
  if (detailAddress && detailAddress.length > 200) {
    throw new InvalidArgumentError(
      'INVALID_ADDRESS',
      '상세 주소는 200자까지 쓸 수 있어요.',
    );
  }
  return {
    ...input,
    label,
    address,
    detailAddress,
    sigungu: input.sigungu?.trim() || null,
    dong: input.dong?.trim() || null,
  };
}
