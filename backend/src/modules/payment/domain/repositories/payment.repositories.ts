import { OrderCharge } from '../entities/order-charge.entity.js';
import { OrderRefund } from '../entities/order-refund.entity.js';
import { PaymentMethod } from '../entities/payment-method.entity.js';

export const PAYMENT_METHOD_REPOSITORY = Symbol('PAYMENT_METHOD_REPOSITORY');
export const ORDER_CHARGE_REPOSITORY = Symbol('ORDER_CHARGE_REPOSITORY');
export const ORDER_REFUND_REPOSITORY = Symbol('ORDER_REFUND_REPOSITORY');

/** 등록한 카드 저장소 계약. */
export interface PaymentMethodRepository {
  save(method: PaymentMethod): Promise<void>;
  findById(id: string): Promise<PaymentMethod | null>;
  /** 지우지 않은 카드를 등록한 순서대로. */
  findUsableByUser(userId: string): Promise<PaymentMethod[]>;
}

/** 주문의 카드 결제 저장소 계약. */
export interface OrderChargeRepository {
  save(charge: OrderCharge): Promise<void>;
  /** 한 주문의 결제를 결제한 순서대로. */
  findByOrder(orderId: string): Promise<OrderCharge[]>;
  findByOrders(orderIds: string[]): Promise<OrderCharge[]>;
}

/** 주문의 환불 기록 저장소 계약. */
export interface OrderRefundRepository {
  save(refund: OrderRefund): Promise<void>;
  /** 여러 주문의 환불을 돌려준 순서대로. */
  findByOrders(orderIds: string[]): Promise<OrderRefund[]>;
}
