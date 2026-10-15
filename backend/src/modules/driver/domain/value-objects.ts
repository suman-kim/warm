import { InvalidArgumentError } from '../../../common/domain/domain-error.js';

/** 정산 계좌의 본인 확인 상태. */
export enum AccountVerificationStatus {
  /** 아직 확인하지 않았다 */
  UNVERIFIED = 'UNVERIFIED',
  /** 예금주가 가입자 본인이다 */
  VERIFIED = 'VERIFIED',
  /** 확인하지 못했다 (사유가 함께 있다) */
  FAILED = 'FAILED',
}

/** 정산 계좌의 본인 확인 결과. */
export interface AccountVerification {
  status: AccountVerificationStatus;
  /** 확인하지 못한 사유 (FAILED일 때) */
  failureReason: string | null;
  /** 마지막으로 확인을 시도한 시각 */
  attemptedAt: Date | null;
  /** 확인된 시각 (VERIFIED일 때) */
  verifiedAt: Date | null;
}

const UNVERIFIED: AccountVerification = {
  status: AccountVerificationStatus.UNVERIFIED,
  failureReason: null,
  attemptedAt: null,
  verifiedAt: null,
};

/** 기사의 정산 계좌. */
export class SettlementAccount {
  private constructor(
    readonly bankName: string,
    /** 숫자만 */
    readonly accountNumber: string,
    readonly accountHolder: string,
    /** 본인 명의 계좌인지 확인한 결과. 확인되지 않은 계좌로는 정산금을 보내지 않는다(보류). */
    readonly verification: AccountVerification = UNVERIFIED,
  ) {}

  static of(
    input: {
      bankName: string;
      accountNumber: string;
      accountHolder: string;
    },
    verification: AccountVerification = UNVERIFIED,
  ): SettlementAccount {
    const bankName = input.bankName.trim();
    const accountNumber = input.accountNumber.replace(/[\s-]/g, '');
    const accountHolder = input.accountHolder.trim();
    if (
      bankName.length < 1 ||
      bankName.length > 30 ||
      !/^\d{8,16}$/.test(accountNumber) ||
      accountHolder.length < 1 ||
      accountHolder.length > 50
    ) {
      throw new InvalidArgumentError(
        'INVALID_SETTLEMENT_ACCOUNT',
        '은행, 계좌번호, 예금주를 확인해 주세요.',
      );
    }
    return new SettlementAccount(
      bankName,
      accountNumber,
      accountHolder,
      verification,
    );
  }

  get isVerified(): boolean {
    return this.verification.status === AccountVerificationStatus.VERIFIED;
  }

  /** 본인 확인 결과를 담은 새 계좌 정보. */
  withVerification(verification: AccountVerification): SettlementAccount {
    return new SettlementAccount(
      this.bankName,
      this.accountNumber,
      this.accountHolder,
      verification,
    );
  }

  /** 화면에 보여줄 때는 끝 네 자리만 남긴다 (예: ••••1024). */
  get maskedNumber(): string {
    return `••••${this.accountNumber.slice(-4)}`;
  }
}
