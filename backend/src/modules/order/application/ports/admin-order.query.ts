import { Paged, PageRequest } from '../../../../common/domain/pagination.js';
import { VehicleType } from '../../../../common/domain/vehicle-type.js';
import { OrderStatus } from '../../domain/order-status.js';
import { Period } from '../../domain/repositories/order.repository.js';
import { OrderPaymentStatus } from '../dto/order.result.js';

/** 주문 현황 조회 DI 토큰. */
export const ADMIN_ORDER_QUERY = Symbol('ADMIN_ORDER_QUERY');

/** 주문 현황의 결제 탭. REFUND는 일부 환불과 전액 환불을 함께 본다. */
export enum AdminPaymentFilter {
  UNPAID = 'UNPAID',
  PAID = 'PAID',
  FAILED = 'FAILED',
  REFUND = 'REFUND',
}

/** 운영자의 주문 현황 한 줄. 고객과 기사의 이름, 결제 상태가 붙는다. */
export interface AdminOrderRow {
  id: string;
  requestedAt: Date;
  vehicleType: VehicleType;
  pickupAddress: string;
  pickupDong: string | null;
  dropoffAddress: string;
  dropoffDong: string | null;
  distanceKm: number;
  customerName: string | null;
  driverName: string | null;
  /** 배차 때 결제하는 요금 */
  fare: number;
  /** 최종 요금 (추가 요금·대기료 포함) */
  totalFare: number;
  status: OrderStatus;
  paymentStatus: OrderPaymentStatus;
  /** 결제한 금액의 합 */
  paidAmount: number;
  refundedAmount: number;
}

export interface AdminOrderFilter {
  period: Period;
  /** 고른 상태들 중 하나 (비우면 전부) */
  statuses?: OrderStatus[];
  payment?: AdminPaymentFilter;
}

/** 운영자의 주문 현황 조회. 요청한 시각이 [period]에 드는 주문을 본다. */
export interface AdminOrderQuery {
  /** 상태별 건수, 결제 탭별 건수, 결제한 금액과 환불한 금액의 합. */
  summarize(period: Period): Promise<{
    counts: Record<OrderStatus, number>;
    paymentCounts: Record<AdminPaymentFilter, number>;
    paidAmount: number;
    refundedAmount: number;
  }>;
  /** 최근에 요청한 것부터. */
  find(
    filter: AdminOrderFilter,
    page: PageRequest,
  ): Promise<Paged<AdminOrderRow>>;
}
