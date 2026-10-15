import { CardType } from '../../domain/entities/payment-method.entity.js';
import { PaymentFailureCode } from '../../domain/payment-failure.js';

/** PG사 연동 DI 토큰. */
export const PAYMENT_GATEWAY = Symbol('PAYMENT_GATEWAY');

/** 앱이 PG사의 카드 등록 화면을 열 때 필요한 값. */
export interface CardRegistrationSetup {
  /** 어느 연동인지. DEV면 개발용 카드 등록 화면을, PORTONE이면 포트원 카드 등록 창을 띄운다. */
  provider: 'DEV' | 'PORTONE';
  /** 포트원 상점 ID. DEV면 null. */
  storeId: string | null;
  /** 포트원 채널 키 — 어느 PG사로 카드를 등록할지. DEV면 null. */
  channelKey: string | null;
}

export type ChargeOutcome =
  | {
      ok: true;
      paymentKey: string;
      approvalNumber: string;
      approvedAt: Date;
    }
  | { ok: false; failureCode: PaymentFailureCode; message: string };

/**
 * PG사 연동 포트. 카드 등록(빌링키 발급), 빌링키 결제, 결제 취소.
 * 운영은 포트원(PG사는 나이스페이먼츠), 로컬 개발은 돈이 오가지 않는 개발용 연동을 쓴다.
 */
export interface PaymentGateway {
  registrationSetup(): CardRegistrationSetup;
  /**
   * 앱이 PG사 화면에서 받은 값으로 카드를 확인한다.
   * 포트원은 등록 창이 빌링키를 바로 돌려주므로 [authKey]가 빌링키다 — 서버는 이 고객의 카드인지 확인한다.
   */
  issueBillingKey(input: { customerKey: string; authKey: string }): Promise<{
    billingKey: string;
    cardBrand: string;
    cardLast4: string;
    cardType: CardType;
  }>;
  /** 빌링키로 결제한다. 고객이 앱을 보고 있지 않아도 된다. */
  charge(input: {
    billingKey: string;
    customerKey: string;
    /** 결제 한 건의 고유 ID (PG사에 주문번호로 넘긴다) */
    chargeId: string;
    amount: number;
    /** 카드 명세서에 보일 이름 */
    orderName: string;
  }): Promise<ChargeOutcome>;
  /** 결제를 [amount]만큼 취소한다 (부분 취소 가능). */
  cancel(input: {
    paymentKey: string;
    amount: number;
    reason: string;
  }): Promise<void>;
  /** 카드를 지울 때 빌링키를 없앤다. */
  removeBillingKey(billingKey: string): Promise<void>;
}
