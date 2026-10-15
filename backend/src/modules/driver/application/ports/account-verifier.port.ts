/** 정산 계좌 본인 확인 DI 토큰. */
export const ACCOUNT_VERIFIER = Symbol('ACCOUNT_VERIFIER');

export type AccountVerificationOutcome =
  { ok: true } | { ok: false; reason: string };

/**
 * 정산 계좌가 가입자 본인 명의인지 확인하는 포트.
 * 실제로는 PG사 지급대행의 계좌 실명 조회(1원 입금 확인 등)를 부른다 — 지금은 개발용 구현만 있다.
 */
export interface AccountVerifier {
  verify(input: {
    bankName: string;
    accountNumber: string;
    accountHolder: string;
    /** 가입자 이름 (예금주와 견준다) */
    ownerName: string;
  }): Promise<AccountVerificationOutcome>;
}
