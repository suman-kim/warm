/** 손님 결제(PG) DI 토큰. */
export const PAYMENT_GATEWAY = Symbol('PAYMENT_GATEWAY');

/** 결제창을 여는 데 필요한 값. 손님 앱이 PG SDK에 그대로 넘긴다. */
export interface CheckoutInfo {
  /** 어느 PG 연동인지: PORTONE(포트원 V2) | DEV(개발용, 결제창 없이 바로 결제된다) */
  provider: string;
  paymentId: string;
  orderName: string;
  amount: number;
  currency: 'KRW';
  /** 포트원 상점 ID·채널 키. 포트원이 아니면 null. */
  storeId: string | null;
  channelKey: string | null;
}

export enum GatewayPaymentStatus {
  PAID = 'PAID',
  /** 결제창이 열렸거나 승인을 기다린다 */
  PENDING = 'PENDING',
  FAILED = 'FAILED',
  /** 전부 또는 일부를 돌려줬다 */
  CANCELLED = 'CANCELLED',
}

/** PG에 물어본 결제 한 건. */
export interface GatewayPayment {
  paymentId: string;
  status: GatewayPaymentStatus;
  /** 결제된 금액 (원) */
  amount: number;
}

/**
 * 손님 결제를 맡는 PG 포트. 어느 PG사를 쓰는지는 구현이 정한다 — 지금은 포트원 V2(나이스페이먼츠 채널)와
 * 개발용 구현이 있고, 키가 있으면 포트원을 쓴다. PG사를 바꿔도 주문 흐름은 그대로다.
 */
export interface PaymentGateway {
  /** 결제창을 열기 전에 금액을 PG에 미리 등록한다 (손님 앱에서 금액을 바꾸지 못하게). */
  prepare(input: {
    paymentId: string;
    amount: number;
    orderName: string;
  }): Promise<CheckoutInfo>;
  /** 결제 상태를 PG에 묻는다. 없으면 null. */
  getPayment(paymentId: string): Promise<GatewayPayment | null>;
  /**
   * 결제의 일부나 전부를 돌려준다. [cancellableAmount]는 지금 돌려줄 수 있다고 아는 금액이다 —
   * PG의 값과 다르면(이미 돌려줬으면) PG가 거절해 두 번 돌려주지 않는다.
   */
  cancel(input: {
    paymentId: string;
    amount: number;
    reason: string;
    cancellableAmount: number;
  }): Promise<void>;
  /** 웹훅 서명을 확인한다. 틀리면 null, 결제와 상관없는 웹훅이면 paymentId가 null이다. */
  verifyWebhook(
    rawBody: string,
    headers: Record<string, string | string[] | undefined>,
  ): Promise<{ paymentId: string | null } | null>;
}
