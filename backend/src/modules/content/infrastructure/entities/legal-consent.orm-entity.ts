import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

/** 약관 동의 기록 ORM 엔티티. 동의 한 번에 한 줄. */
@Entity({
  name: 'legal_consents',
  comment: '약관 동의 기록 (어느 판에 언제 동의했는지)',
})
@Index('idx_legal_consents_user', ['userId', 'agreedAt'])
export class LegalConsentOrmEntity {
  @PrimaryColumn('uuid', { comment: '동의 기록 ID' })
  id: string;

  @Column('uuid', { name: 'user_id', comment: 'users.id' })
  userId: string;

  @Column('varchar', {
    length: 20,
    comment:
      '약관 종류: TERMS | PRIVACY | LOCATION | REFUND | DRIVER | MARKETING',
  })
  type: string;

  @Column('varchar', {
    length: 20,
    nullable: true,
    comment: '동의한 시각에 시행 중이던 판 번호 (올린 판이 없었으면 NULL)',
  })
  version: string | null;

  @Column('timestamptz', { name: 'agreed_at', comment: '동의한 시각' })
  agreedAt: Date;
}
