import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

/** 약관·정책 ORM 엔티티. 판마다 한 줄. */
@Entity({ name: 'legal_documents', comment: '약관·정책 문서 (판마다 한 줄)' })
@Index('uq_legal_documents_type_version', ['type', 'version'], { unique: true })
@Index('idx_legal_documents_type_effective', ['type', 'effectiveAt'])
export class LegalDocumentOrmEntity {
  @PrimaryColumn('uuid', { comment: '문서 ID' })
  id: string;

  @Column('varchar', {
    length: 20,
    comment: 'TERMS | PRIVACY | LOCATION | REFUND | DRIVER | MARKETING',
  })
  type: string;

  @Column('varchar', { length: 20, comment: '판 번호' })
  version: string;

  @Column('varchar', { length: 100, comment: '제목' })
  title: string;

  @Column('text', { comment: '본문' })
  body: string;

  @Column('timestamptz', { name: 'effective_at', comment: '시행일' })
  effectiveAt: Date;

  @Column('timestamptz', { name: 'created_at', comment: '올린 시각' })
  createdAt: Date;

  @Column('uuid', {
    name: 'created_by',
    nullable: true,
    comment: '올린 운영자 (users.id)',
  })
  createdBy: string | null;
}
