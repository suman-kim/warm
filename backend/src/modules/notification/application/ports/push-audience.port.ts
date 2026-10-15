import { VehicleType } from '../../../../common/domain/vehicle-type.js';

/** 알림 대상 조회 포트 DI 토큰. */
export const PUSH_AUDIENCE = Symbol('PUSH_AUDIENCE');

/**
 * 알림을 받을 기사를 찾는 포트. 알림 컨텍스트가 기사 컨텍스트를 직접 알지 않도록 사이에 둔다.
 * (고객은 주문 이벤트에 회원 ID가 실려 와 조회가 필요 없다.)
 */
export interface PushAudience {
  /**
   * 지금 이 차종의 주문을 수락할 수 있는(승인됐고 운행 중인) 기사 중, [near]에서 반경 안에
   * 최근 위치를 보낸 기사들의 회원 ID.
   */
  findAvailableDriverUserIds(
    vehicleType: VehicleType,
    near: { latitude: number; longitude: number; radiusKm: number },
  ): Promise<string[]>;
  /** 기사의 회원 ID. 없는 기사면 null. */
  findDriverUserId(driverId: string): Promise<string | null>;
}
