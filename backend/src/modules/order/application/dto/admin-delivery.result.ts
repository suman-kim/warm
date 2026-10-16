import { OrderStatus } from '../../domain/order-status.js';
import { DoorPayment } from '../../domain/value-objects/store-delivery.js';

/** 배달 관제의 알림: 배차 지연(요청 뒤 10분) · 픽업 지연(요청 뒤 20분) */
export enum DeliveryFlag {
  DISPATCH_LATE = 'DISPATCH_LATE',
  PICKUP_LATE = 'PICKUP_LATE',
}

/** 진행 중인 가게 배달의 단계별 건수와 지연 건수. */
export class DeliveryMonitorSummaryResult {
  /** 라이더 찾는 중 */
  searching: number;
  /** 가게로 오는 중 (배정·출발) */
  toStore: number;
  /** 라이더 가게 도착 */
  atStore: number;
  /** 배달 중 */
  delivering: number;
  dispatchLate: number;
  pickupLate: number;
}

/** 배달 관제의 한 줄. */
export class DeliveryMonitorItemResult {
  id: string;
  /** 주문번호 (예: MV261015-1Z40) */
  code: string;
  requestedAt: Date;
  status: OrderStatus;
  storeName: string;
  /** 손님 동 (없으면 주소의 앞 두 마디) */
  customerArea: string;
  /** 요청하고 지난 분 */
  elapsedMinutes: number;
  riderName: string | null;
  doorPayment: DoorPayment;
  foodAmount: number;
  /** 지연 알림. 없으면 null. */
  flag: DeliveryFlag | null;
}

export class DeliveryMonitorResult {
  summary: DeliveryMonitorSummaryResult;
  /** 지연된 것부터, 그다음 오래된 것부터 */
  items: DeliveryMonitorItemResult[];
}

/** 하루의 라이더 현금 수금 요약. */
export class RiderCashSummaryResult {
  /** 한국 날짜 (YYYY-MM-DD) */
  date: string;
  /** 만나서 받은 현금 합(원) */
  total: number;
  /** 가게에 넘긴 금액 합(원) */
  handed: number;
  /** 아직 가게에 넘기지 않은 금액 합(원)과 건수 */
  pending: number;
  pendingCount: number;
  count: number;
}

/** 라이더 현금 수금 한 줄. */
export class RiderCashItemResult {
  orderId: string;
  code: string;
  deliveredAt: Date;
  riderName: string | null;
  storeName: string;
  /** 라이더가 받은 현금(원) */
  collectedAmount: number;
  /** 가게가 적은 음식값(원) — 받은 금액과 다르면 화면에서 알린다 */
  foodAmount: number;
  /** 가게에 넘긴 시각. 아직이면 null. */
  handedAt: Date | null;
}

export class RiderCashResult {
  summary: RiderCashSummaryResult;
  items: RiderCashItemResult[];
}
