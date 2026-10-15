/** 인증 코드가 유효한 시간. */
export const RESET_CODE_TTL_MS = 10 * 60 * 1000;
/** 틀릴 수 있는 횟수. 넘으면 코드를 새로 받아야 한다. */
export const RESET_CODE_MAX_ATTEMPTS = 5;
/**
 * 코드를 다시 받으려면 기다려야 하는 시간. 코드를 계속 새로 받아 가며 맞히는 것과
 * 남의 메일함에 코드를 퍼붓는 것을 막는다.
 */
export const RESET_CODE_RESEND_INTERVAL_MS = 60 * 1000;

/**
 * 비밀번호 재설정 인증 코드. 코드 원문은 저장하지 않고 해시만 둔다.
 * 회원마다 가장 최근에 받은 하나만 유효하다.
 */
export class PasswordResetCode {
  constructor(
    readonly id: string,
    readonly userId: string,
    readonly codeHash: string,
    readonly expiresAt: Date,
    readonly attempts: number,
    readonly usedAt: Date | null,
    readonly createdAt: Date,
  ) {}

  static issue(input: {
    id: string;
    userId: string;
    codeHash: string;
    now: Date;
  }): PasswordResetCode {
    return new PasswordResetCode(
      input.id,
      input.userId,
      input.codeHash,
      new Date(input.now.getTime() + RESET_CODE_TTL_MS),
      0,
      null,
      input.now,
    );
  }

  /** 새 코드를 받아도 되는지 (받은 지 1분이 지났다). */
  canBeReplaced(now: Date): boolean {
    return (
      now.getTime() - this.createdAt.getTime() >= RESET_CODE_RESEND_INTERVAL_MS
    );
  }

  /** 아직 확인을 시도할 수 있는지 (쓰지 않았고, 만료 전이고, 너무 많이 틀리지 않았다). */
  isUsable(now: Date): boolean {
    return (
      this.usedAt === null &&
      this.expiresAt > now &&
      this.attempts < RESET_CODE_MAX_ATTEMPTS
    );
  }
}
