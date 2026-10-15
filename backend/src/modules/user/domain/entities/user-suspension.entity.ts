/**
 * 회원 정지 기록. 정지할 때마다 한 줄이 생기고, 해제하면 해제한 시각이 적힌다.
 * 지금 정지 중인지는 회원(User)이 알고, 이 기록은 운영자가 보는 이력이다.
 */
export class UserSuspension {
  constructor(
    readonly id: string,
    readonly userId: string,
    readonly reason: string,
    /** 정지한 운영자 (회원 ID) */
    readonly suspendedBy: string,
    readonly startedAt: Date,
    /** 정지가 끝나는 시각. 무기한이면 null. */
    readonly endsAt: Date | null,
    private currentLiftedAt: Date | null,
  ) {}

  /** 운영자가 해제한 시각. 해제하지 않았으면 null. */
  get liftedAt(): Date | null {
    return this.currentLiftedAt;
  }

  /** 정지 기간(일). 무기한이면 null. */
  get days(): number | null {
    return this.endsAt
      ? Math.round(
          (this.endsAt.getTime() - this.startedAt.getTime()) / 86_400_000,
        )
      : null;
  }

  /** [now]에 이 정지가 걸려 있는지. */
  isInEffect(now: Date): boolean {
    return (
      this.currentLiftedAt === null &&
      (this.endsAt === null || this.endsAt > now)
    );
  }

  lift(now: Date): void {
    this.currentLiftedAt ??= now;
  }
}
