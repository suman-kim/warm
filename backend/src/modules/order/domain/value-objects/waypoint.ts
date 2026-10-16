import { InvalidArgumentError } from '../../../../common/domain/domain-error.js';
import { PhoneNumber } from '../../../../common/domain/phone-number.js';
import { GeoPoint } from './geo-point.js';

export interface WaypointInput {
  address: string;
  detailAddress?: string | null;
  /** 시·군·구 (예: 성동구). 주소 검색 결과에서 받는다. */
  sigungu?: string | null;
  /** 읍·면·동 (예: 성수동2가) */
  dong?: string | null;
  latitude: number;
  longitude: number;
  contactName: string;
  contactPhone: string;
}

/** 픽업지·도착지 값 객체. 주소, 좌표, 현장 연락처를 묶는다. */
export class Waypoint {
  private constructor(
    readonly address: string,
    readonly detailAddress: string | null,
    readonly sigungu: string | null,
    readonly dong: string | null,
    readonly point: GeoPoint,
    readonly contactName: string,
    readonly contactPhone: PhoneNumber,
  ) {}

  static of(input: WaypointInput): Waypoint {
    const address = input.address.trim();
    if (address.length < 1 || address.length > 200) {
      throw new InvalidArgumentError(
        'INVALID_ADDRESS',
        '주소를 1~200자로 입력해 주세요.',
      );
    }
    const contactName = input.contactName.trim();
    if (contactName.length < 1 || contactName.length > 50) {
      throw new InvalidArgumentError(
        'INVALID_CONTACT_NAME',
        '연락처 이름을 1~50자로 입력해 주세요.',
      );
    }
    return new Waypoint(
      address,
      input.detailAddress?.trim() || null,
      input.sigungu?.trim() || null,
      input.dong?.trim() || null,
      GeoPoint.of(input.latitude, input.longitude),
      contactName,
      PhoneNumber.contact(input.contactPhone),
    );
  }

  /**
   * 동 단위까지만 적은 위치 (예: 성동구 성수동2가). 아직 수락하지 않은 기사에게는
   * 이것만 보여준다. 주소 검색에서 구·동을 받지 못한 주문이면 주소의 앞 두 마디
   * (예: 서울 성동구)만 쓴다 — 도로명과 번지는 내보내지 않는다.
   */
  get area(): string {
    return (
      [this.sigungu, this.dong].filter(Boolean).join(' ') ||
      this.address.split(/\s+/).slice(0, 2).join(' ')
    );
  }
}
