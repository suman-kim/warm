import { Logger } from '@nestjs/common';
import type { PaymentClient } from '@portone/server-sdk';
import type { Card } from '@portone/server-sdk/common';
import {
  InvalidArgumentError,
  UnavailableError,
} from '../../../../common/domain/domain-error.js';
import {
  CardRegistrationSetup,
  ChargeOutcome,
  PaymentGateway,
} from '../../application/ports/payment-gateway.port.js';
import { CardType } from '../../domain/entities/payment-method.entity.js';
import { PaymentFailureCode } from '../../domain/payment-failure.js';

/** 포트원 SDK가 던지는 오류의 모양. 종류(type)와 PG사가 준 코드·메시지가 있다. */
interface PortOneErrorData {
  type: string;
  message?: string;
  pgCode?: string;
  pgMessage?: string;
}

function portOneError(error: unknown): PortOneErrorData | null {
  const data = (error as { data?: unknown } | null)?.data;
  return typeof data === 'object' &&
    data !== null &&
    typeof (data as { type?: unknown }).type === 'string'
    ? (data as PortOneErrorData)
    : null;
}

/** 포트원 카드사 코드 → 앱에 보일 카드사 이름 */
const CARD_COMPANIES: Readonly<Record<string, string>> = {
  SHINHAN_CARD: '신한카드',
  KOOKMIN_CARD: '국민카드',
  HYUNDAI_CARD: '현대카드',
  SAMSUNG_CARD: '삼성카드',
  LOTTE_CARD: '롯데카드',
  BC_CARD: '비씨카드',
  HANA_CARD: '하나카드',
  WOORI_CARD: '우리카드',
  NH_CARD: '농협카드',
  CITI_CARD: '씨티카드',
  SUHYUP_CARD: '수협카드',
  JEONBUK_CARD: '전북카드',
  JEJU_CARD: '제주카드',
  GWANGJU_CARD: '광주카드',
  KAKAO_BANK: '카카오뱅크',
  K_BANK: '케이뱅크',
  TOSS_BANK: '토스뱅크',
  SHINHYUP: '신협카드',
  EPOST: '우체국카드',
  KFCC: '새마을금고카드',
  SAVINGS_BANK_KOREA: '저축은행카드',
  KOREA_DEVELOPMENT_BANK: '산업은행카드',
};

/** 카드사 이름. 발급사 코드 → 발행사 코드 → 카드 상품명 순서로 찾는다. */
export function cardCompanyOf(card: Card): string {
  for (const code of [card.issuer, card.publisher]) {
    if (code && CARD_COMPANIES[code]) {
      return CARD_COMPANIES[code];
    }
  }
  return card.name?.trim().slice(0, 30) || '카드';
}

/** PG사가 준 거절 사유를 고객에게 안내할 사유로 묶는다. */
export function failureCodeOf(pgMessage: string): PaymentFailureCode {
  if (/한도/.test(pgMessage)) return PaymentFailureCode.LIMIT_EXCEEDED;
  if (/잔액|잔고/.test(pgMessage)) {
    return PaymentFailureCode.INSUFFICIENT_BALANCE;
  }
  if (/정지|만료|유효기간|분실|도난|해지|사용\s*불가/.test(pgMessage)) {
    return PaymentFailureCode.CARD_SUSPENDED_OR_EXPIRED;
  }
  if (/점검|시스템|통신|지연/.test(pgMessage)) {
    return PaymentFailureCode.ISSUER_MAINTENANCE;
  }
  if (/인증|비밀번호/.test(pgMessage)) {
    return PaymentFailureCode.AUTHENTICATION_REQUIRED;
  }
  return PaymentFailureCode.UNKNOWN;
}

/**
 * 포트원 V2 연동. PG사는 포트원 콘솔의 채널로 정한다 (MOVO는 나이스페이먼츠).
 * 앱은 포트원 등록 창에서 빌링키를 받아 오고, 서버는 그 빌링키를 확인해 저장한 뒤 결제·취소에 쓴다.
 * 결제 건 아이디(paymentId)는 MOVO의 결제 ID(chargeId)를 그대로 쓴다 — 같은 결제를 두 번 하지 않는다.
 */
export class PortOnePaymentGateway implements PaymentGateway {
  private readonly logger = new Logger(PortOnePaymentGateway.name);

  constructor(
    private readonly payment: PaymentClient,
    private readonly storeId: string,
    private readonly channelKey: string,
  ) {}

  registrationSetup(): CardRegistrationSetup {
    return {
      provider: 'PORTONE',
      storeId: this.storeId,
      channelKey: this.channelKey,
    };
  }

  async issueBillingKey(input: {
    customerKey: string;
    authKey: string;
  }): Promise<{
    billingKey: string;
    cardBrand: string;
    cardLast4: string;
    cardType: CardType;
  }> {
    const billingKey = input.authKey;
    const info = await this.payment.billingKey
      .getBillingKeyInfo({ billingKey, storeId: this.storeId })
      .catch((error: unknown) => {
        const data = portOneError(error);
        if (data?.type === 'BILLING_KEY_NOT_FOUND') {
          throw registrationFailed();
        }
        this.logger.error('빌링키를 확인하지 못했어요', error);
        throw new UnavailableError(
          'PAYMENT_PROVIDER_UNAVAILABLE',
          '카드사와 연결하지 못했어요. 잠시 뒤 다시 시도해 주세요.',
        );
      });
    // 다른 고객이 받은 빌링키를 보내는 경우를 막는다 — 등록 창에서 고객 키를 넘겼다.
    if (
      info.status !== 'ISSUED' ||
      !('customer' in info) ||
      info.customer.id !== input.customerKey
    ) {
      throw registrationFailed();
    }
    const card = info.methods?.find(
      (method) => method.type === 'BillingKeyPaymentMethodCard',
    )?.card;
    const last4 = /(\d{4})\D*$/.exec(card?.number ?? '')?.[1];
    if (!card || !last4) {
      // 카드가 아니거나 카드 번호를 알 수 없으면 쓰지 않는다 — 앱에 카드를 보여줄 수 없다.
      this.logger.warn(
        `빌링키의 카드 정보를 알 수 없어요: ${card?.number ?? '카드 아님'}`,
      );
      await this.removeBillingKey(billingKey);
      throw registrationFailed();
    }
    return {
      billingKey,
      cardBrand: cardCompanyOf(card),
      cardLast4: last4,
      cardType: card.type === 'CREDIT' ? CardType.CREDIT : CardType.CHECK,
    };
  }

  async charge(input: {
    billingKey: string;
    customerKey: string;
    chargeId: string;
    amount: number;
    orderName: string;
  }): Promise<ChargeOutcome> {
    try {
      const { payment } = await this.payment.payWithBillingKey({
        paymentId: input.chargeId,
        storeId: this.storeId,
        billingKey: input.billingKey,
        orderName: input.orderName,
        customer: { id: input.customerKey },
        amount: { total: input.amount },
        currency: 'KRW',
      });
      return this.paid(input.chargeId, payment.pgTxId, payment.paidAt);
    } catch (error) {
      const data = portOneError(error);
      switch (data?.type) {
        case 'PG_PROVIDER': {
          const message = data.pgMessage || data.message || '';
          return {
            ok: false,
            failureCode: failureCodeOf(message),
            message,
          };
        }
        case 'BILLING_KEY_ALREADY_DELETED':
        case 'BILLING_KEY_NOT_FOUND':
          return {
            ok: false,
            failureCode: PaymentFailureCode.CARD_SUSPENDED_OR_EXPIRED,
            message: '빌링키가 없어요',
          };
        case 'ALREADY_PAID':
          // 같은 결제를 다시 보냈다 (응답을 받지 못하고 다시 시도한 경우).
          return this.lookUp(input.chargeId);
        default:
          if (data) {
            // 키·채널 설정이 틀렸거나 요청이 잘못된 경우 — 운영자가 고쳐야 한다.
            this.logger.error(
              `포트원 결제 요청이 거절됐어요: ${data.type} ${data.message ?? ''}`,
            );
            return {
              ok: false,
              failureCode: PaymentFailureCode.UNKNOWN,
              message: data.type,
            };
          }
          // 응답을 받지 못했다 — 결제가 됐을 수도 있으니 확인한다.
          this.logger.warn(
            `포트원 결제 응답을 받지 못했어요: ${String(error)}`,
          );
          return this.lookUp(input.chargeId);
      }
    }
  }

  async cancel(input: {
    paymentKey: string;
    amount: number;
    reason: string;
  }): Promise<void> {
    try {
      await this.payment.cancelPayment({
        paymentId: input.paymentKey,
        storeId: this.storeId,
        amount: input.amount,
        reason: input.reason,
      });
    } catch (error) {
      const data = portOneError(error);
      this.logger.error(
        `결제를 취소하지 못했어요 (${input.paymentKey} ${input.amount}원): ${data?.type ?? String(error)} ${data?.pgMessage ?? data?.message ?? ''}`,
      );
      throw new UnavailableError(
        'REFUND_FAILED',
        '카드 결제를 취소하지 못했어요. 잠시 뒤 다시 시도해 주세요.',
      );
    }
  }

  async removeBillingKey(billingKey: string): Promise<void> {
    try {
      await this.payment.billingKey.deleteBillingKey({
        billingKey,
        storeId: this.storeId,
      });
    } catch (error) {
      const type = portOneError(error)?.type;
      if (
        type === 'BILLING_KEY_ALREADY_DELETED' ||
        type === 'BILLING_KEY_NOT_FOUND'
      ) {
        return;
      }
      // 카드는 MOVO에서 이미 지웠다 — 빌링키는 포트원 콘솔에서 지우면 된다.
      this.logger.error(`빌링키를 지우지 못했어요: ${billingKey}`, error);
    }
  }

  /** 결제 건을 조회해 결제됐으면 승인 정보를, 아니면 실패를 돌려준다. */
  private async lookUp(paymentId: string): Promise<ChargeOutcome> {
    const payment = await this.payment
      .getPayment({ paymentId, storeId: this.storeId })
      .catch((error: unknown) => {
        this.logger.error(`결제 건을 조회하지 못했어요: ${paymentId}`, error);
        return null;
      });
    if (payment?.status === 'PAID') {
      return this.paid(paymentId, payment.pgTxId ?? '', payment.paidAt);
    }
    const failure =
      payment?.status === 'FAILED' ? (payment.failure.pgMessage ?? '') : '';
    return {
      ok: false,
      failureCode: failure
        ? failureCodeOf(failure)
        : PaymentFailureCode.UNKNOWN,
      message: failure || '결제 결과를 알 수 없어요',
    };
  }

  /** 결제됨. 승인번호는 결제 건의 카드 정보에서 읽고, 없으면 PG사 거래 번호를 쓴다. */
  private async paid(
    paymentId: string,
    pgTxId: string,
    paidAt: string,
  ): Promise<ChargeOutcome> {
    const payment = await this.payment
      .getPayment({ paymentId, storeId: this.storeId })
      .catch(() => null);
    const method = payment?.status === 'PAID' ? payment.method : undefined;
    const approvalNumber =
      method?.type === 'PaymentMethodCard' ? method.approvalNumber : undefined;
    return {
      ok: true,
      paymentKey: paymentId,
      approvalNumber: (approvalNumber || pgTxId || paymentId).slice(0, 30),
      approvedAt: new Date(paidAt),
    };
  }
}

function registrationFailed(): InvalidArgumentError {
  return new InvalidArgumentError(
    'CARD_REGISTRATION_FAILED',
    '카드를 등록하지 못했어요. 다시 시도해 주세요.',
  );
}
