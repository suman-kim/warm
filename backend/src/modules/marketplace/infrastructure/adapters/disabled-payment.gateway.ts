import { UnavailableError } from '../../../../common/domain/domain-error.js';
import {
  CheckoutInfo,
  GatewayPayment,
  PaymentGateway,
} from '../../application/ports/payment-gateway.port.js';

/**
 * 운영 서버에 PG 키가 없을 때. 결제를 받지 않는다 — 개발용 PG처럼 결제 없이 주문이 들어가면 안 되기 때문이다.
 */
export class DisabledPaymentGateway implements PaymentGateway {
  prepare(): Promise<CheckoutInfo> {
    return Promise.reject(unavailable());
  }

  getPayment(): Promise<GatewayPayment | null> {
    return Promise.resolve(null);
  }

  cancel(): Promise<void> {
    return Promise.reject(unavailable());
  }

  verifyWebhook(): Promise<{ paymentId: string | null } | null> {
    return Promise.resolve(null);
  }
}

function unavailable(): UnavailableError {
  return new UnavailableError(
    'PAYMENT_UNAVAILABLE',
    '지금은 결제를 받을 수 없어요.',
  );
}
