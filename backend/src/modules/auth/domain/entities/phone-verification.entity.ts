/** 인증 코드가 유효한 시간. */
export const PHONE_CODE_TTL_MS = 5 * 60 * 1000;
/** 틀릴 수 있는 횟수. 넘으면 코드를 새로 받아야 한다. */
export const PHONE_CODE_MAX_ATTEMPTS = 5;
/** 같은 번호로 코드를 다시 받으려면 기다려야 하는 시간 (문자 폭탄·코드 맞히기를 막는다). */
export const PHONE_CODE_RESEND_INTERVAL_MS = 60 * 1000;
/** 인증한 뒤 가입에 쓸 수 있는 시간. */
export const PHONE_TOKEN_TTL_MS = 30 * 60 * 1000;

/**
 * 휴대폰 번호 인증. 문자로 받은 6자리 코드를 맞히면 가입에 한 번 쓸 수 있는 인증 토큰을 준다.
 * 코드와 토큰은 원문을 저장하지 않고 해시만 둔다. 번호마다 가장 최근 것 하나만 쓴다.
 */
export class PhoneVerification {
  constructor(
    readonly id: string,
    /** 숫자만 */
    readonly phone: string,
    readonly codeHash: string,
    readonly expiresAt: Date,
    readonly attempts: number,
    readonly verifiedAt: Date | null,
    readonly tokenHash: string | null,
    readonly usedAt: Date | null,
    readonly createdAt: Date,
  ) {}

  static issue(input: {
    id: string;
    phone: string;
    codeHash: string;
    now: Date;
  }): PhoneVerification {
    return new PhoneVerification(
      input.id,
      input.phone,
      input.codeHash,
      new Date(input.now.getTime() + PHONE_CODE_TTL_MS),
      0,
      null,
      null,
      null,
      input.now,
    );
  }

  /** 새 코드를 보내도 되는지 (보낸 지 1분이 지났다). */
  canBeReplaced(now: Date): boolean {
    return (
      now.getTime() - this.createdAt.getTime() >= PHONE_CODE_RESEND_INTERVAL_MS
    );
  }

  /** 코드 확인을 시도할 수 있는지 (인증 전이고, 만료 전이고, 너무 많이 틀리지 않았다). */
  isCodeUsable(now: Date): boolean {
    return (
      this.verifiedAt === null &&
      this.expiresAt > now &&
      this.attempts < PHONE_CODE_MAX_ATTEMPTS
    );
  }

  /** 인증 토큰을 가입에 쓸 수 있는지 (인증했고, 아직 쓰지 않았고, 30분 안이다). */
  isTokenUsable(now: Date): boolean {
    return (
      this.verifiedAt !== null &&
      this.usedAt === null &&
      now.getTime() - this.verifiedAt.getTime() < PHONE_TOKEN_TTL_MS
    );
  }
}
