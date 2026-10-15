import { DomainEvent } from '../../../../common/domain/domain-event.js';
import { ChargeKind } from '../entities/order-charge.entity.js';

/** 주문의 카드 결제가 끝났다 — 고객에게 결제 알림을 보낼 시점. */
export class OrderChargePaidEvent extends DomainEvent {
  static readonly EVENT_NAME = 'payment.charge-paid';
  readonly eventName = OrderChargePaidEvent.EVENT_NAME;
  constructor(
    orderId: string,
    occurredAt: Date,
    readonly customerId: string,
    readonly kind: ChargeKind,
    readonly amount: number,
    /** 신한카드 ••4821 */
    readonly cardLabel: string,
    /** 성수동 → 역삼동 */
    readonly routeLabel: string,
  ) {
    super(orderId, occurredAt);
  }
}

/** 픽업할 때의 추가 결제가 안 됐다. (배차 때의 실패는 주문의 OrderPaymentFailedEvent) */
export class OrderAdditionalChargeFailedEvent extends DomainEvent {
  static readonly EVENT_NAME = 'payment.additional-charge-failed';
  readonly eventName = OrderAdditionalChargeFailedEvent.EVENT_NAME;
  constructor(
    orderId: string,
    occurredAt: Date,
    readonly customerId: string,
    readonly amount: number,
    readonly failureCode: string,
    readonly routeLabel: string,
  ) {
    super(orderId, occurredAt);
  }
}

/** 결제한 금액의 일부나 전부를 돌려줬다. */
export class OrderRefundedEvent extends DomainEvent {
  static readonly EVENT_NAME = 'payment.refunded';
  readonly eventName = OrderRefundedEvent.EVENT_NAME;
  constructor(
    orderId: string,
    occurredAt: Date,
    readonly customerId: string,
    readonly amount: number,
    /** 취소 수수료로 남긴 금액. 운영자가 돌려준 경우는 0. */
    readonly cancellationFee: number,
    readonly reason: string,
    readonly routeLabel: string,
  ) {
    super(orderId, occurredAt);
  }
}
