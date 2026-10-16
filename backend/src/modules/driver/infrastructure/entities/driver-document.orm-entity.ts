import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

/** 기사 서류 ORM 엔티티. 회원·종류마다 한 행. */
@Entity({ name: 'driver_documents', comment: '기사 등록 서류' })
@Index('uq_driver_documents_user_type', ['userId', 'type'], { unique: true })
export class DriverDocumentOrmEntity {
  @PrimaryColumn('uuid', { comment: '서류 ID' })
  id: string;

  @Column('uuid', { name: 'user_id', comment: 'users.id' })
  userId: string;

  @Column('varchar', {
    length: 30,
    comment: 'DRIVER_LICENSE | VEHICLE_REGISTRATION | DELIVERY_INSURANCE',
  })
  type: string;

  @Column('varchar', { length: 20, comment: 'SUBMITTED | APPROVED | REJECTED' })
  status: string;

  @Column('varchar', {
    name: 'storage_key',
    length: 200,
    comment: '파일 보관소(FileStorage)에서 파일을 찾는 키',
  })
  storageKey: string;

  @Column('varchar', {
    name: 'content_type',
    length: 50,
    comment: '파일 형식 (MIME, 예: image/png, application/pdf)',
  })
  contentType: string;

  @Column('int', { comment: '파일 크기(바이트)' })
  size: number;

  @Column('text', {
    name: 'rejection_reason',
    nullable: true,
    comment: '반려 사유 (운영자가 적은 것). 반려되지 않았으면 NULL',
  })
  rejectionReason: string | null;

  @Column('timestamptz', { name: 'uploaded_at', comment: '올린 시각' })
  uploadedAt: Date;

  @Column('timestamptz', {
    name: 'reviewed_at',
    nullable: true,
    comment: '심사한 시각. 심사 전이면 NULL',
  })
  reviewedAt: Date | null;
}
