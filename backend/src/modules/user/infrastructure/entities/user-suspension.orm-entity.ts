import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

/** 회원 정지 기록 ORM 엔티티. */
@Entity({ name: 'user_suspensions', comment: '회원 정지 기록' })
@Index('idx_user_suspensions_user', ['userId', 'startedAt'])
export class UserSuspensionOrmEntity {
  @PrimaryColumn('uuid', { comment: '정지 기록 ID' })
  id: string;

  @Column('uuid', { name: 'user_id', comment: 'users.id' })
  userId: string;

  @Column('varchar', { length: 500, comment: '정지 사유' })
  reason: string;

  @Column('uuid', {
    name: 'suspended_by',
    comment: '정지한 운영자 (users.id)',
  })
  suspendedBy: string;

  @Column('timestamptz', { name: 'started_at', comment: '정지가 시작된 시각' })
  startedAt: Date;

  @Column('timestamptz', {
    name: 'ends_at',
    nullable: true,
    comment: '정지가 끝나는 시각. 무기한이면 NULL',
  })
  endsAt: Date | null;

  @Column('timestamptz', {
    name: 'lifted_at',
    nullable: true,
    comment: '운영자가 해제한 시각',
  })
  liftedAt: Date | null;
}
