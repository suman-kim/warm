/**
 * 배달 상태.
 *
 * REQUESTED → ASSIGNED → (DEPARTED) → ARRIVED → PICKED_UP → DELIVERED
 * 픽업 전까지는 가게가 취소할 수 있다 (CANCELLED). 라이더는 수락하고 가게로 가서 [가게 도착]을 누른다 —
 * 출발(DEPARTED)은 거치지 않아도 된다.
 */
export enum OrderStatus {
  /** 배차 대기 — 라이더가 수락할 수 있다 */
  REQUESTED = 'REQUESTED',
  /** 배차 완료 — 라이더가 가게로 오는 중 */
  ASSIGNED = 'ASSIGNED',
  /** 라이더가 가게로 출발했다 */
  DEPARTED = 'DEPARTED',
  /** 라이더가 가게에 도착했다 */
  ARRIVED = 'ARRIVED',
  /** 픽업 완료 — 손님에게 배달 중 */
  PICKED_UP = 'PICKED_UP',
  /** 배달 완료 */
  DELIVERED = 'DELIVERED',
  /** 취소됨 */
  CANCELLED = 'CANCELLED',
}

/** 라이더가 맡아 진행 중인 상태 (배차 완료 ~ 배달 완료 전). */
export const IN_PROGRESS_STATUSES: readonly OrderStatus[] = [
  OrderStatus.ASSIGNED,
  OrderStatus.DEPARTED,
  OrderStatus.ARRIVED,
  OrderStatus.PICKED_UP,
];

/** 아직 끝나지 않은 상태 (가게 쪽에서 본 '진행 중인 배달'). */
export const UNFINISHED_STATUSES: readonly OrderStatus[] = [
  OrderStatus.REQUESTED,
  ...IN_PROGRESS_STATUSES,
];

/** 픽업하러 가는 중인 상태 (배차 완료 ~ 픽업 전). */
export const AWAITING_PICKUP_STATUSES: readonly OrderStatus[] = [
  OrderStatus.ASSIGNED,
  OrderStatus.DEPARTED,
  OrderStatus.ARRIVED,
];
