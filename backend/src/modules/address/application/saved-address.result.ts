import { SavedAddress } from '../domain/saved-address.js';

/** 자주 쓰는 주소 응답. */
export class SavedAddressResult {
  id: string;
  /** 회원이 붙인 이름 (예: 역삼 사무실) */
  label: string;
  address: string;
  detailAddress: string | null;
  sigungu: string | null;
  dong: string | null;
  latitude: number;
  longitude: number;
  createdAt: Date;
}

export function toSavedAddressResult(
  address: SavedAddress,
): SavedAddressResult {
  return {
    id: address.id,
    label: address.label,
    address: address.address,
    detailAddress: address.detailAddress,
    sigungu: address.sigungu,
    dong: address.dong,
    latitude: address.latitude,
    longitude: address.longitude,
    createdAt: address.createdAt,
  };
}
