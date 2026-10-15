import {
  ChargeKind,
  ChargeStatus,
} from '../../../payment/domain/entities/order-charge.entity.js';
import { CardType } from '../../../payment/domain/entities/payment-method.entity.js';

/** 주문 결제 포트 DI 토큰. */
export const ORDER_PAYMENTS = Symbol('ORDER_PAYMENTS');

/** 결제에 쓰는(쓴) 카드 */
export interface PaymentCard {
  paymentMethodId: string;
  brand: string;
  last4: string;
  type: CardType;
}

/** 주문의 카드 결제 한 건 */
export interface ChargeRecord {
  id: string;
  kind: ChargeKind;
  amount: number;
  status: ChargeStatus;
  card: PaymentCard;
  approvalNumber: string | null;
  approvedAt: Date | null;
  failureCode: string | null;
  failedAt: Date | null;
  /** 돌려준 금액의 합 */
  cancelledAmount: number;
  cancelledAt: Date | null;
}

/** 돌려준 한 건 */
export interface RefundRecord {
  id: string;
  amount: number;
  reason: string;
  /** 돌려준 운영자 (회원 ID). 고객 취소로 자동 환불했으면 null. */
  refundedBy: string | null;
  refundedAt: Date;
}

/** 주문의 결제와 환불 기록 (각각 일어난 순서) */
export interface PaymentHistory {
  charges: ChargeRecord[];
  refunds: RefundRecord[];
}

export const NO_PAYMENT_HISTORY: PaymentHistory = { charges: [], refunds: [] };

export type ChargeAttempt =
  | { ok: true; charge: ChargeRecord }
  | { ok: false; failureCode: string; charge: ChargeRecord | null };

/**
 * 주문의 카드 결제 포트. 결제 컨텍스트가 구현한다.
 * 서버가 고객이 등록한 카드(빌링키)로 결제한다 — 배차될 때 요금을, 픽업할 때 추가 요금을.
 */
export interface OrderPayments {
  /** 고객이 이 주문에 쓸 카드. [paymentMethodId]가 없거나 쓸 수 없으면 기본 카드. 카드가 없으면 null. */
  cardFor(
    customerId: string,
    paymentMethodId?: string | null,
  ): Promise<PaymentCard | null>;
  charge(input: {
    orderId: string;
    customerId: string;
    paymentMethodId: string | null;
    kind: ChargeKind;
    amount: number;
    /** 카드 명세서에 보일 이름 */
    orderName: string;
    /** 알림에 적을 구간 (예: 성수동 → 역삼동) */
    routeLabel: string;
  }): Promise<ChargeAttempt>;
  /** 결제한 금액에서 [amount]를 돌려준다. 결제한 것보다 많으면 ConflictError. */
  refund(input: {
    orderId: string;
    customerId: string;
    amount: number;
    reason: string;
    /** 알림에 적을 취소 수수료 (운영자가 돌려준 경우 0) */
    cancellationFee: number;
    /** 돌려준 운영자. 고객 취소로 자동 환불하면 null. */
    actorId: string | null;
    routeLabel: string;
  }): Promise<void>;
  /** 한 주문의 결제와 환불 기록 */
  historyOf(orderId: string): Promise<PaymentHistory>;
  /** 여러 주문의 결제와 환불 기록을 주문 ID별로 */
  historiesOf(orderIds: string[]): Promise<Map<string, PaymentHistory>>;
}
