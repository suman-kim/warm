/**
 * 주문 상태.
 *
 * REQUESTED → PAYING → ASSIGNED → DEPARTED → ARRIVED → PICKED_UP → DELIVERED
 *                └→ PAYMENT_FAILED ─(다른 카드로 다시 요청)→ REQUESTED
 * 픽업 전까지는 고객이 취소할 수 있고(CANCELLED), 기사가 도착한 뒤 고객이 나오지 않으면 NO_SHOW.
 */
export enum OrderStatus {
  /** 배차 대기 — 기사가 수락할 수 있다 */
  REQUESTED = 'REQUESTED',
  /** 기사가 수락해 고객의 카드로 결제하는 중 */
  PAYING = 'PAYING',
  /** 배차 때 결제가 안 됐다 — 고객이 다른 카드로 다시 요청할 수 있다 */
  PAYMENT_FAILED = 'PAYMENT_FAILED',
  /** 배차 완료 — 기사가 출발하기 전 */
  ASSIGNED = 'ASSIGNED',
  /** 기사가 픽업지로 출발했다 */
  DEPARTED = 'DEPARTED',
  /** 기사가 픽업지에 도착해 기다리는 중 */
  ARRIVED = 'ARRIVED',
  /** 픽업 완료 — 배송 중 */
  PICKED_UP = 'PICKED_UP',
  /** 배송 완료 */
  DELIVERED = 'DELIVERED',
  /** 취소됨 */
  CANCELLED = 'CANCELLED',
  /** 기사가 도착하고 기다렸는데 고객이 나오지 않았다 */
  NO_SHOW = 'NO_SHOW',
}

/** 기사가 맡아 진행 중인 상태 (배차 완료 ~ 배송 완료 전). */
export const IN_PROGRESS_STATUSES: readonly OrderStatus[] = [
  OrderStatus.ASSIGNED,
  OrderStatus.DEPARTED,
  OrderStatus.ARRIVED,
  OrderStatus.PICKED_UP,
];

/** 아직 끝나지 않은 상태 (고객 쪽에서 본 '진행 중인 주문'). */
export const UNFINISHED_STATUSES: readonly OrderStatus[] = [
  OrderStatus.REQUESTED,
  OrderStatus.PAYING,
  OrderStatus.PAYMENT_FAILED,
  ...IN_PROGRESS_STATUSES,
];

/** 픽업하러 가는 중인 상태 (배차 완료 ~ 픽업 전). */
export const AWAITING_PICKUP_STATUSES: readonly OrderStatus[] = [
  OrderStatus.ASSIGNED,
  OrderStatus.DEPARTED,
  OrderStatus.ARRIVED,
];
