import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

/** 정산 계좌 ORM 엔티티. 기사마다 한 행. */
@Entity({ name: 'driver_settlement_accounts', comment: '기사 정산 계좌' })
export class SettlementAccountOrmEntity {
  @PrimaryColumn('uuid', { name: 'driver_id', comment: 'drivers.id' })
  driverId: string;

  @Column('varchar', { name: 'bank_name', length: 30, comment: '은행 이름' })
  bankName: string;

  @Column('varchar', { name: 'account_number', length: 16, comment: '숫자만' })
  accountNumber: string;

  @Column('varchar', { name: 'account_holder', length: 50, comment: '예금주' })
  accountHolder: string;

  @Column('varchar', {
    name: 'verification_status',
    length: 20,
    default: 'UNVERIFIED',
    comment: '본인 확인: UNVERIFIED | VERIFIED | FAILED',
  })
  verificationStatus: string;

  @Column('varchar', {
    name: 'verification_failure_reason',
    length: 200,
    nullable: true,
    comment:
      '본인 확인을 하지 못한 사유 (예: 예금주 이름이 가입자 이름과 달라요). 확인되면 NULL',
  })
  verificationFailureReason: string | null;

  @Column('timestamptz', {
    name: 'verification_attempted_at',
    nullable: true,
    comment: '본인 확인을 마지막으로 시도한 시각',
  })
  verificationAttemptedAt: Date | null;

  @Column('timestamptz', {
    name: 'verified_at',
    nullable: true,
    comment: '본인 확인이 된 시각',
  })
  verifiedAt: Date | null;
  @UpdateDateColumn({
    name: 'updated_at',
    type: 'timestamptz',
    comment: '마지막으로 바뀐 시각',
  })
  updatedAt: Date;
}
