import { VehicleType } from '../../../../common/domain/vehicle-type.js';
import { OrderStatus } from '../../domain/order-status.js';
import {
  ChargeResult,
  OrderPaymentStatus,
  OrderResult,
  PaymentCardResult,
} from './order.result.js';

/** 하루의 주문 요약. */
export class AdminOrderSummaryResult {
  /** 한국 날짜 (YYYY-MM-DD) */
  date: string;
  total: number;
  counts: Record<OrderStatus, number>;
  /** 결제 탭별 건수 (UNPAID·PAID·FAILED·REFUND) */
  paymentCounts: Record<'UNPAID' | 'PAID' | 'FAILED' | 'REFUND', number>;
  /** 결제한 금액의 합(원) */
  paidAmount: number;
  /** 환불한 금액의 합(원) */
  refundedAmount: number;
  /** 거래액(원) = 결제한 금액 − 환불한 금액 */
  revenue: number;
}

/** 주문 현황의 한 줄. */
export class AdminOrderListItemResult {
  id: string;
  /** 주문번호 (예: MV261013-3F9A) */
  code: string;
  requestedAt: Date;
  vehicleType: VehicleType;
  /** 출발지의 동 (예: 성수동2가) */
  pickupArea: string;
  dropoffArea: string;
  distanceKm: number;
  customerName: string | null;
  /** 배차 전이면 null */
  driverName: string | null;
  /** 배차 때 결제하는 요금 */
  fare: number;
  /** 최종 요금 (추가 요금·대기료 포함) */
  totalFare: number;
  status: OrderStatus;
  paymentStatus: OrderPaymentStatus;
  paidAmount: number;
  refundedAmount: number;
}

export class AdminOrderPageResult {
  items: AdminOrderListItemResult[];
  total: number;
  page: number;
  size: number;
}

/** 환불 한 건 (운영자용) */
export class AdminRefundResult {
  amount: number;
  reason: string;
  /** 돌려준 운영자 이름. 고객 취소로 자동 환불했으면 null. */
  refundedByName: string | null;
  automatic: boolean;
  refundedAt: Date;
}

/** 운영자가 보는 주문의 결제 */
export class AdminOrderPaymentResult {
  status: OrderPaymentStatus;
  card: PaymentCardResult | null;
  paidAmount: number;
  refundedAmount: number;
  /** 더 돌려줄 수 있는 금액 = 결제한 금액 − 환불한 금액 */
  refundableAmount: number;
  /** 결제가 안 된 추가 요금 */
  unpaidAmount: number;
  charges: ChargeResult[];
  refunds: AdminRefundResult[];
}

/** 주문 상세 (운영자용). 고객·기사 연락처와 결제·환불 기록이 붙는다. */
export class AdminOrderDetailResult extends OrderResult {
  customer: { id: string; name: string | null; phone: string | null };
  driver: {
    id: string;
    name: string;
    phone: string;
    vehicleNumber: string;
  } | null;
  payment: AdminOrderPaymentResult;
}
