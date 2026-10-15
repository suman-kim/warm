import { Column, Entity, Index, PrimaryColumn } from 'typeorm';
import { PayoutStatus } from '../../domain/entities/payout.entity.js';

/** 정산 지급 기록 ORM 엔티티. 실패한 지급도 남긴다. */
@Entity({ name: 'settlement_payouts', comment: '정산 지급 기록' })
// 기사 한 명의 한 주에 지급 완료·진행 중은 하나뿐이다 (실패는 여러 번 있을 수 있다).
@Index('uq_settlement_payouts_driver_week', ['driverId', 'weekStart'], {
  unique: true,
  where: `"status" <> 'FAILED'`,
})
@Index('idx_settlement_payouts_paid_at', ['paidAt'])
export class PayoutOrmEntity {
  @PrimaryColumn('uuid', { comment: '지급 ID' })
  id: string;

  @Column('uuid', { name: 'driver_id', comment: 'drivers.id' })
  driverId: string;

  @Column('timestamptz', {
    name: 'week_start',
    comment: '정산한 주의 시작 (한국 시간 월요일 0시)',
  })
  weekStart: Date;

  @Column('int', { comment: '완료한 배송 수' })
  trips: number;

  @Column('int', { comment: '운행 매출(원) — 최종 요금 합' })
  gross: number;

  @Column('int', {
    name: 'extra_fare',
    default: 0,
    comment: '그중 추가 요금과 대기료(원)',
  })
  extraFare: number;

  @Column('int', { comment: '수수료(원)' })
  fee: number;

  @Column('int', { default: 0, comment: '취소 보상(원)' })
  compensation: number;

  @Column('int', { comment: '지급할 금액(원)' })
  net: number;

  @Column('varchar', {
    name: 'bank_name',
    length: 30,
    comment: '보낸 계좌의 은행 (지급 당시)',
  })
  bankName: string;

  @Column('varchar', {
    name: 'masked_account_number',
    length: 30,
    comment: '보낸 계좌 번호 (끝 4자리만, 예: ••••1024)',
  })
  maskedAccountNumber: string;

  @Column('varchar', {
    length: 20,
    default: PayoutStatus.PAID,
    comment: 'REQUESTED | PAID | FAILED',
  })
  status: PayoutStatus;

  @Column('varchar', {
    name: 'failure_reason',
    length: 200,
    nullable: true,
    comment: '보내지 못한 사유. 실패했을 때만 있다',
  })
  failureReason: string | null;

  @Column('timestamptz', { name: 'paid_at', comment: '지급 처리(요청)한 시각' })
  paidAt: Date;

  @Column('timestamptz', {
    name: 'completed_at',
    nullable: true,
    comment: '보냈거나 보내지 못한 것이 확인된 시각',
  })
  completedAt: Date | null;

  @Column('uuid', { name: 'paid_by', comment: '지급 처리한 운영자 (users.id)' })
  paidBy: string;
}
