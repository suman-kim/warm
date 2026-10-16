import { Injectable, Logger } from '@nestjs/common';
import {
  CheckoutInfo,
  GatewayPayment,
  GatewayPaymentStatus,
  PaymentGateway,
} from '../../application/ports/payment-gateway.port.js';

/**
 * 개발용 PG. 결제창 없이, 미리 등록한 결제는 곧바로 결제된 것으로 본다.
 * 포트원 키가 없을 때(개발·e2e) 쓴다. 서버를 다시 켜면 등록한 결제는 잊는다.
 */
@Injectable()
export class DevPaymentGateway implements PaymentGateway {
  private readonly logger = new Logger(DevPaymentGateway.name);
  private readonly payments = new Map<
    string,
    { amount: number; cancelled: number }
  >();

  prepare(input: {
    paymentId: string;
    amount: number;
    orderName: string;
  }): Promise<CheckoutInfo> {
    this.payments.set(input.paymentId, { amount: input.amount, cancelled: 0 });
    return Promise.resolve({
      provider: 'DEV',
      paymentId: input.paymentId,
      orderName: input.orderName,
      amount: input.amount,
      currency: 'KRW',
      storeId: null,
      channelKey: null,
    });
  }

  getPayment(paymentId: string): Promise<GatewayPayment | null> {
    const payment = this.payments.get(paymentId);
    return Promise.resolve(
      payment
        ? {
            paymentId,
            status:
              payment.cancelled > 0
                ? GatewayPaymentStatus.CANCELLED
                : GatewayPaymentStatus.PAID,
            amount: payment.amount,
          }
        : null,
    );
  }

  cancel(input: {
    paymentId: string;
    amount: number;
    reason: string;
    cancellableAmount: number;
  }): Promise<void> {
    const payment = this.payments.get(input.paymentId);
    if (payment) {
      const cancellable = payment.amount - payment.cancelled;
      if (
        cancellable !== input.cancellableAmount ||
        input.amount > cancellable
      ) {
        return Promise.reject(new Error('돌려줄 수 있는 금액이 맞지 않아요.'));
      }
      payment.cancelled += input.amount;
    }
    this.logger.log(
      `[개발] 환불 ${input.amount}원 (${input.paymentId}): ${input.reason}`,
    );
    return Promise.resolve();
  }

  /** 개발용 웹훅: 서명 없이 {"paymentId": "..."}를 받는다. */
  verifyWebhook(rawBody: string): Promise<{ paymentId: string | null } | null> {
    try {
      const body = JSON.parse(rawBody) as { paymentId?: unknown };
      return Promise.resolve({
        paymentId: typeof body.paymentId === 'string' ? body.paymentId : null,
      });
    } catch {
      return Promise.resolve(null);
    }
  }
}
