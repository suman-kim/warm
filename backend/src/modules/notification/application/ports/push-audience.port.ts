/** 알림 대상 조회 포트 DI 토큰. */
export const PUSH_AUDIENCE = Symbol('PUSH_AUDIENCE');

/**
 * 알림을 받을 라이더를 찾는 포트. 알림 컨텍스트가 라이더 컨텍스트를 직접 알지 않도록 사이에 둔다.
 * (사장님은 배달 이벤트에 회원 ID가 실려 와 조회가 필요 없다.)
 */
export interface PushAudience {
  /**
   * 지금 콜을 받을 수 있는(승인됐고 운행 중인) 라이더 중, [near]에서 반경 안에
   * 최근 위치를 보낸 라이더들의 회원 ID.
   */
  findAvailableDriverUserIds(near: {
    latitude: number;
    longitude: number;
    radiusKm: number;
  }): Promise<string[]>;
  /** 라이더의 회원 ID. 없는 라이더면 null. */
  findDriverUserId(driverId: string): Promise<string | null>;
}
