import { randomInt, randomUUID } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { InvalidArgumentError } from '../../../../common/domain/domain-error.js';
import {
  CardRegistrationSetup,
  ChargeOutcome,
  PaymentGateway,
} from '../../application/ports/payment-gateway.port.js';
import { CardType } from '../../domain/entities/payment-method.entity.js';
import {
  PAYMENT_FAILURE_GUIDE,
  PaymentFailureCode,
} from '../../domain/payment-failure.js';

/**
 * 끝 4자리로 결제 실패를 흉내 내는 시험용 카드.
 * 앱의 개발용 카드 등록 화면에서 이 번호로 등록하면 배차 때 그 사유로 결제가 안 된다.
 */
export const DEV_FAILING_CARDS: Readonly<Record<string, PaymentFailureCode>> = {
  '0001': PaymentFailureCode.LIMIT_EXCEEDED,
  '0002': PaymentFailureCode.INSUFFICIENT_BALANCE,
  '0003': PaymentFailureCode.CARD_SUSPENDED_OR_EXPIRED,
  '0004': PaymentFailureCode.ISSUER_MAINTENANCE,
  '0005': PaymentFailureCode.AUTHENTICATION_REQUIRED,
  '0009': PaymentFailureCode.UNKNOWN,
};

const DEV_AUTH_KEY = /^dev:([^:]{1,30}):(\d{4}):(CREDIT|CHECK)$/;
const DEV_BILLING_KEY = /^dev_(\d{4})_/;

/**
 * 개발용 PG 연동. 돈이 오가지 않는다 — 포트원 키 없이 로컬에서 결제 흐름을 만들고 시험하려고 둔다.
 * 앱은 PG사 화면 대신 카드사·끝 4자리·종류를 고르는 화면을 띄우고, `dev:<카드사>:<끝4자리>:<CREDIT|CHECK>`를
 * 인증 키로 보낸다. 운영(NODE_ENV=production)에서는 모듈이 이 구현을 쓰지 않는다.
 */
@Injectable()
export class DevPaymentGateway implements PaymentGateway {
  private readonly logger = new Logger(DevPaymentGateway.name);

  registrationSetup(): CardRegistrationSetup {
    return { provider: 'DEV', storeId: null, channelKey: null };
  }

  issueBillingKey(input: { customerKey: string; authKey: string }): Promise<{
    billingKey: string;
    cardBrand: string;
    cardLast4: string;
    cardType: CardType;
  }> {
    const match = DEV_AUTH_KEY.exec(input.authKey);
    if (!match) {
      throw new InvalidArgumentError(
        'CARD_REGISTRATION_FAILED',
        '카드를 등록하지 못했어요. 다시 시도해 주세요.',
      );
    }
    const [, cardBrand, cardLast4, cardType] = match;
    return Promise.resolve({
      billingKey: `dev_${cardLast4}_${randomUUID()}`,
      cardBrand,
      cardLast4,
      cardType: cardType as CardType,
    });
  }

  charge(input: {
    billingKey: string;
    customerKey: string;
    chargeId: string;
    amount: number;
    orderName: string;
  }): Promise<ChargeOutcome> {
    const last4 = DEV_BILLING_KEY.exec(input.billingKey)?.[1];
    const failure = last4 ? DEV_FAILING_CARDS[last4] : undefined;
    this.logger.log(
      `[개발용 결제] ${input.orderName} ${input.amount}원 → ${failure ?? '승인'}`,
    );
    if (failure) {
      return Promise.resolve({
        ok: false,
        failureCode: failure,
        message: PAYMENT_FAILURE_GUIDE[failure].title,
      });
    }
    return Promise.resolve({
      ok: true,
      paymentKey: `devpay_${input.chargeId}`,
      approvalNumber: String(randomInt(10_000_000, 100_000_000)),
      approvedAt: new Date(),
    });
  }

  cancel(input: {
    paymentKey: string;
    amount: number;
    reason: string;
  }): Promise<void> {
    this.logger.log(
      `[개발용 결제 취소] ${input.paymentKey} ${input.amount}원 (${input.reason})`,
    );
    return Promise.resolve();
  }

  removeBillingKey(): Promise<void> {
    return Promise.resolve();
  }
}
