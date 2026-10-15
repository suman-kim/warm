/**
 * 리프레시 토큰 도메인 엔티티.
 * 토큰 원문은 저장하지 않고 해시만 보관한다. 한 번 쓰면 폐기하고 새로 발급한다(회전).
 */
export class RefreshToken {
  constructor(
    readonly id: string,
    readonly userId: string,
    readonly tokenHash: string,
    readonly expiresAt: Date,
    readonly revokedAt: Date | null,
    readonly createdAt: Date,
  ) {}

  /** 아직 쓸 수 있는지 (폐기되지 않았고 만료 전). */
  isUsable(now: Date): boolean {
    return this.revokedAt === null && this.expiresAt > now;
  }
}
