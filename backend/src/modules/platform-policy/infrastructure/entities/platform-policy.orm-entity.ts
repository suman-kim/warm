import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

@Entity({
  name: 'platform_policies',
  comment: '운영자가 서버 배포 없이 바꾸는 정책 (주문앱 수수료·정산 주기 등)',
})
export class PlatformPolicyOrmEntity {
  @PrimaryColumn('varchar', {
    length: 40,
    comment: '정책 이름 (MARKETPLACE)',
  })
  key: string;

  @Column('jsonb', { comment: '정책 값' })
  value: Record<string, unknown>;

  @Column('timestamptz', {
    name: 'updated_at',
    comment: '마지막으로 바꾼 시각',
  })
  updatedAt: Date;

  @Column('uuid', {
    name: 'updated_by',
    nullable: true,
    comment: '마지막으로 바꾼 운영자 (users.id)',
  })
  updatedBy: string | null;
}

@Entity({ name: 'platform_policy_changes', comment: '정책을 바꾼 기록' })
@Index('idx_policy_changes_key', ['key', 'changedAt'])
export class PlatformPolicyChangeOrmEntity {
  @PrimaryColumn('uuid', { comment: '기록 ID' })
  id: string;

  @Column('varchar', { length: 40, comment: '정책 이름 (MARKETPLACE)' })
  key: string;

  @Column('jsonb', { comment: '바꾼 뒤의 정책 값 전체' })
  value: Record<string, unknown>;

  @Column('timestamptz', { name: 'changed_at', comment: '바꾼 시각' })
  changedAt: Date;

  @Column('uuid', { name: 'changed_by', comment: '바꾼 운영자 (users.id)' })
  changedBy: string;
}
