/** 이 시간 안에 */
export const LOGIN_FAILURE_WINDOW_MS = 15 * 60_000;
/** 이만큼 틀리면 */
export const LOGIN_MAX_FAILURES = 5;
/** 이 시간 동안 로그인을 막는다. */
export const LOGIN_LOCK_MS = 15 * 60_000;

/**
 * 한 이메일의 로그인 실패 기록. 짧은 시간에 여러 번 틀리면 잠시 막아 비밀번호를 하나씩 대 보는 것을 막는다.
 * 가입하지 않은 이메일도 똑같이 센다 — 막히는지로 가입 여부를 알 수 없게.
 */
export class LoginAttempt {
  constructor(
    /** 소문자로 맞춘 이메일 */
    readonly email: string,
    private currentFailures: number,
    private currentWindowStartedAt: Date,
    private currentLockedUntil: Date | null,
  ) {}

  static first(email: string, now: Date): LoginAttempt {
    return new LoginAttempt(email, 0, now, null);
  }

  get failures(): number {
    return this.currentFailures;
  }

  get windowStartedAt(): Date {
    return this.currentWindowStartedAt;
  }

  get lockedUntil(): Date | null {
    return this.currentLockedUntil;
  }

  /** [now]에 막혀 있는지. */
  isLocked(now: Date): boolean {
    return this.currentLockedUntil !== null && this.currentLockedUntil > now;
  }

  /** 막힌 동안 남은 시간(분, 올림). */
  minutesLeft(now: Date): number {
    if (!this.isLocked(now)) return 0;
    return Math.ceil(
      (this.currentLockedUntil!.getTime() - now.getTime()) / 60_000,
    );
  }

  /** 한 번 틀렸다. 실패가 쌓여 막혔으면 true. */
  recordFailure(now: Date): boolean {
    if (
      now.getTime() - this.currentWindowStartedAt.getTime() >
      LOGIN_FAILURE_WINDOW_MS
    ) {
      this.currentFailures = 0;
      this.currentWindowStartedAt = now;
    }
    this.currentFailures += 1;
    if (this.currentFailures >= LOGIN_MAX_FAILURES) {
      this.currentLockedUntil = new Date(now.getTime() + LOGIN_LOCK_MS);
      this.currentFailures = 0;
      this.currentWindowStartedAt = now;
      return true;
    }
    return false;
  }
}
