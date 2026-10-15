import { Injectable } from '@nestjs/common';
import { OrderPaymentService } from '../../../payment/application/services/order-payment.service.js';
import {
  ChargeKind,
  OrderCharge,
} from '../../../payment/domain/entities/order-charge.entity.js';
import { OrderRefund } from '../../../payment/domain/entities/order-refund.entity.js';
import { PaymentMethod } from '../../../payment/domain/entities/payment-method.entity.js';
import {
  ChargeAttempt,
  ChargeRecord,
  NO_PAYMENT_HISTORY,
  OrderPayments,
  PaymentCard,
  PaymentHistory,
  RefundRecord,
} from '../../application/ports/order-payments.port.js';

/** 주문 결제 포트 구현체. 결제 컨텍스트의 OrderPaymentService에 맡긴다. */
@Injectable()
export class OrderPaymentsAdapter implements OrderPayments {
  constructor(private readonly payments: OrderPaymentService) {}

  async cardFor(
    customerId: string,
    paymentMethodId?: string | null,
  ): Promise<PaymentCard | null> {
    const method = await this.payments.cardFor(customerId, paymentMethodId);
    return method && toCard(method);
  }

  async charge(input: {
    orderId: string;
    customerId: string;
    paymentMethodId: string | null;
    kind: ChargeKind;
    amount: number;
    orderName: string;
    routeLabel: string;
  }): Promise<ChargeAttempt> {
    const outcome = await this.payments.charge(input);
    return outcome.ok
      ? { ok: true, charge: toRecord(outcome.charge) }
      : {
          ok: false,
          failureCode: outcome.failureCode,
          charge: outcome.charge && toRecord(outcome.charge),
        };
  }

  refund(input: {
    orderId: string;
    customerId: string;
    amount: number;
    reason: string;
    cancellationFee: number;
    actorId: string | null;
    routeLabel: string;
  }): Promise<void> {
    return this.payments.refund(input);
  }

  async historyOf(orderId: string): Promise<PaymentHistory> {
    return (
      (await this.historiesOf([orderId])).get(orderId) ?? NO_PAYMENT_HISTORY
    );
  }

  async historiesOf(orderIds: string[]): Promise<Map<string, PaymentHistory>> {
    const histories = await this.payments.historiesOf(orderIds);
    return new Map(
      [...histories].map(([orderId, history]) => [
        orderId,
        {
          charges: history.charges.map(toRecord),
          refunds: history.refunds.map(toRefundRecord),
        },
      ]),
    );
  }
}

function toCard(method: PaymentMethod): PaymentCard {
  return {
    paymentMethodId: method.id,
    brand: method.cardBrand,
    last4: method.cardLast4,
    type: method.cardType,
  };
}

function toRefundRecord(refund: OrderRefund): RefundRecord {
  return {
    id: refund.id,
    amount: refund.amount,
    reason: refund.reason,
    refundedBy: refund.refundedBy,
    refundedAt: refund.createdAt,
  };
}

function toRecord(charge: OrderCharge): ChargeRecord {
  const state = charge.snapshot();
  return {
    id: state.id,
    kind: state.kind,
    amount: state.amount,
    status: state.status,
    card: state.card,
    approvalNumber: state.approvalNumber,
    approvedAt: state.approvedAt,
    failureCode: state.failureCode,
    failedAt: state.failedAt,
    cancelledAmount: state.cancelledAmount,
    cancelledAt: state.cancelledAt,
  };
}
