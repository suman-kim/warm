import { OrderStatus } from '../../domain/order-status.js';
import { Period } from '../../domain/repositories/order.repository.js';
import { DoorPayment } from '../../domain/value-objects/store-delivery.js';

/** 배달 관제·라이더 현금 수금 조회 DI 토큰. */
export const ADMIN_DELIVERY_QUERY = Symbol('ADMIN_DELIVERY_QUERY');

/** 진행 중인 가게 배달 한 줄. */
export interface ActiveDeliveryRow {
  id: string;
  requestedAt: Date;
  status: OrderStatus;
  storeName: string;
  dropoffDong: string | null;
  dropoffAddress: string;
  riderName: string | null;
  doorPayment: DoorPayment;
  foodAmount: number;
}

/** 라이더가 만나서 현금으로 받은 배달 한 줄. */
export interface RiderCashRow {
  id: string;
  requestedAt: Date;
  deliveredAt: Date;
  riderName: string | null;
  storeName: string;
  collectedAmount: number;
  foodAmount: number;
  cashHandedAt: Date | null;
}

/** 운영자의 가게 배달 조회. */
export interface AdminDeliveryQuery {
  /** 진행 중(요청 ~ 배달 중)인 가게 배달. 먼저 요청한 것부터. */
  findActive(): Promise<ActiveDeliveryRow[]>;
  /** 전달 시각이 [period]에 드는, 만나서 현금으로 받은 배달. 최근에 전달한 것부터. */
  findCash(period: Period): Promise<RiderCashRow[]>;
}
