import { Logger } from '@nestjs/common';
import { PaymentClient, Webhook } from '@portone/server-sdk';
import {
  CheckoutInfo,
  GatewayPayment,
  GatewayPaymentStatus,
  PaymentGateway,
} from '../../application/ports/payment-gateway.port.js';

export interface PortOneConfig {
  apiSecret: string;
  storeId: string;
  channelKey: string;
  /** 비우면 웹훅을 받지 않는다 (결제 확인은 손님 앱의 완료 요청으로만) */
  webhookSecret: string;
}

/** 포트원 V2 결제 연동. 채널(PG사)은 포트원 콘솔에서 고르고 채널 키로 정한다 — PG사를 바꿔도 코드는 그대로다. */
export class PortOnePaymentGateway implements PaymentGateway {
  private readonly logger = new Logger(PortOnePaymentGateway.name);
  private readonly client: PaymentClient;

  constructor(private readonly config: PortOneConfig) {
    this.client = PaymentClient({ secret: config.apiSecret });
  }

  async prepare(input: {
    paymentId: string;
    amount: number;
    orderName: string;
  }): Promise<CheckoutInfo> {
    await this.client.preRegisterPayment({
      paymentId: input.paymentId,
      totalAmount: input.amount,
      currency: 'KRW',
    });
    return {
      provider: 'PORTONE',
      paymentId: input.paymentId,
      orderName: input.orderName,
      amount: input.amount,
      currency: 'KRW',
      storeId: this.config.storeId,
      channelKey: this.config.channelKey,
    };
  }

  async getPayment(paymentId: string): Promise<GatewayPayment | null> {
    try {
      const payment = await this.client.getPayment({ paymentId });
      switch (payment.status) {
        case 'PAID':
          return {
            paymentId,
            status: GatewayPaymentStatus.PAID,
            amount: payment.amount.total,
          };
        case 'CANCELLED':
        case 'PARTIAL_CANCELLED':
          return {
            paymentId,
            status: GatewayPaymentStatus.CANCELLED,
            amount: payment.amount.total,
          };
        case 'FAILED':
          return { paymentId, status: GatewayPaymentStatus.FAILED, amount: 0 };
        default:
          return { paymentId, status: GatewayPaymentStatus.PENDING, amount: 0 };
      }
    } catch (error) {
      this.logger.warn(
        `결제 조회 실패 (${paymentId}): ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }

  async cancel(input: {
    paymentId: string;
    amount: number;
    reason: string;
    cancellableAmount: number;
  }): Promise<void> {
    await this.client.cancelPayment({
      paymentId: input.paymentId,
      amount: input.amount,
      reason: input.reason.slice(0, 200),
      currentCancellableAmount: input.cancellableAmount,
    });
  }

  async verifyWebhook(
    rawBody: string,
    headers: Record<string, string | string[] | undefined>,
  ): Promise<{ paymentId: string | null } | null> {
    if (!this.config.webhookSecret) return null;
    try {
      const webhook = await Webhook.verify(
        this.config.webhookSecret,
        rawBody,
        headers,
      );
      const data =
        'data' in webhook ? (webhook.data as { paymentId?: unknown }) : null;
      return {
        paymentId: typeof data?.paymentId === 'string' ? data.paymentId : null,
      };
    } catch (error) {
      this.logger.warn(
        `웹훅 서명 확인 실패: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }
}
