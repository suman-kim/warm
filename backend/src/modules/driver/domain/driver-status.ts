/** 기사 심사 상태. */
export enum DriverStatus {
  /** 등록 신청 후 심사 대기 */
  PENDING = 'PENDING',
  /** 승인됨 — 운행을 시작할 수 있다 */
  APPROVED = 'APPROVED',
  /** 반려됨 — 정보를 고쳐 다시 신청할 수 있다 */
  REJECTED = 'REJECTED',
}
