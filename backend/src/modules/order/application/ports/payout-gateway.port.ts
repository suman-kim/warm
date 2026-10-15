/** 정산금 이체 DI 토큰. */
export const PAYOUT_GATEWAY = Symbol('PAYOUT_GATEWAY');

export type PayoutOutcome =
  | { status: 'PAID' }
  /** 이체를 요청했고 결과는 나중에 온다 */
  | { status: 'REQUESTED' }
  | { status: 'FAILED'; reason: string };

/**
 * 기사에게 정산금을 보내는 포트.
 * 실제로는 PG사 지급대행을 부른다 (작업 15·27) — 지금은 운영자가 은행에서 직접 보낸 것을 기록하는 구현만 있다.
 */
export interface PayoutGateway {
  transfer(input: {
    payoutId: string;
    driverId: string;
    amount: number;
    bankName: string;
  }): Promise<PayoutOutcome>;
}
