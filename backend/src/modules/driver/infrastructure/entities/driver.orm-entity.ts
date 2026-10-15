import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

/** 기사 ORM 엔티티. 회원 한 명당 한 행. */
@Entity({ name: 'drivers', comment: '기사 (차량·심사 상태)' })
export class DriverOrmEntity {
  @PrimaryColumn('uuid', { comment: '기사 ID' })
  id: string;

  @Column('uuid', { name: 'user_id', unique: true, comment: 'users.id' })
  userId: string;

  @Column('varchar', {
    name: 'vehicle_type',
    length: 20,
    comment:
      '차종: MOTORCYCLE | DAMAS | LABO | TRUCK_1T | TRUCK_2_5T | TRUCK_5T',
  })
  vehicleType: string;

  @Column('varchar', {
    name: 'vehicle_number',
    length: 15,
    comment: '차량 번호 (예: 서울85자3412)',
  })
  vehicleNumber: string;

  @Index()
  @Column('varchar', { length: 20, comment: 'PENDING | APPROVED | REJECTED' })
  status: string;

  @Column('boolean', { comment: '운행 중(온라인) 여부' })
  available: boolean;

  @Column('text', {
    name: 'rejection_reason',
    nullable: true,
    comment: '반려 사유 (운영자가 적은 것). 반려 상태일 때만 있다',
  })
  rejectionReason: string | null;

  @Column('text', {
    name: 'previous_rejection_reason',
    nullable: true,
    comment: '반려 뒤 다시 신청했을 때 앞서 반려된 사유',
  })
  previousRejectionReason: string | null;

  @Column('timestamptz', {
    name: 'approved_at',
    nullable: true,
    comment: '승인된 시각',
  })
  approvedAt: Date | null;

  @Column('timestamptz', {
    name: 'applied_at',
    comment: '마지막으로 신청한 시각',
  })
  appliedAt: Date;

  @Column('timestamptz', {
    name: 'reviewed_at',
    nullable: true,
    comment: '마지막으로 심사(승인·반려)한 시각',
  })
  reviewedAt: Date | null;

  @Column('uuid', {
    name: 'reviewed_by',
    nullable: true,
    comment: '심사한 운영자 (users.id)',
  })
  reviewedBy: string | null;

  @Column('int', { comment: '낙관적 잠금 버전' })
  version: number;

  @CreateDateColumn({
    name: 'created_at',
    type: 'timestamptz',
    comment: '기사 정보를 처음 만든(등록 신청한) 시각',
  })
  createdAt: Date;

  @UpdateDateColumn({
    name: 'updated_at',
    type: 'timestamptz',
    comment: '마지막으로 바뀐 시각',
  })
  updatedAt: Date;
}
