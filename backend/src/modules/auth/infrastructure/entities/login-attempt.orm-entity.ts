import { Column, Entity, PrimaryColumn } from 'typeorm';

/** 로그인 실패 기록 ORM 엔티티. 이메일마다 한 줄 — 로그인에 성공하면 지운다. */
@Entity({
  name: 'login_attempts',
  comment: '로그인 실패 기록 (여러 번 틀리면 잠시 막는다)',
})
export class LoginAttemptOrmEntity {
  @PrimaryColumn('varchar', {
    length: 254,
    comment: '로그인에 쓴 이메일 (소문자, 가입하지 않은 이메일도 남는다)',
  })
  email: string;

  @Column('int', { comment: '지금 구간에서 틀린 횟수' })
  failures: number;

  @Column('timestamptz', {
    name: 'window_started_at',
    comment: '실패를 세기 시작한 시각 (15분이 지나면 다시 센다)',
  })
  windowStartedAt: Date;

  @Column('timestamptz', {
    name: 'locked_until',
    nullable: true,
    comment: '이 시각까지 로그인을 막는다 (안 막혔으면 NULL)',
  })
  lockedUntil: Date | null;
}
