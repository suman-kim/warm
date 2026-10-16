import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

/** 가게 정산 내역. 지우거나 고치지 않고 쌓고, 지급하면 payout_id가 붙는다. */
@Entity({
  name: 'store_settlement_entries',
  comment: '주문앱 가게 정산 내역 (주문별)',
})
@Index('idx_store_settlement_entries_due', ['storeId', 'payoutDueOn'])
@Index('idx_store_settlement_entries_payout', ['payoutId'])
// 배달 완료·취소 이벤트가 두 번 와도 한 줄만 (부분 환불은 여러 번 있을 수 있다).
@Index('uq_store_settlement_entries_order_kind', ['foodOrderId', 'kind'], {
  unique: true,
  where: `kind <> 'REFUND'`,
})
export class StoreSettlementEntryOrmEntity {
  @PrimaryColumn('uuid', { comment: '정산 내역 ID' })
  id: string;

  @Column('uuid', { name: 'store_id', comment: '가게 (stores.id)' })
  storeId: string;

  @Column('uuid', { name: 'food_order_id', comment: '주문 (food_orders.id)' })
  foodOrderId: string;

  @Column('varchar', {
    length: 20,
    comment:
      'SALE(배달 완료) | CANCELLATION_FEE(가게 취소 수수료) | REFUND(가게 부담 부분 환불)',
  })
  kind: string;

  @Column('int', { comment: '가게가 받는(+)·내는(-) 금액(원)' })
  amount: number;

  @Column('int', { name: 'menu_amount', comment: 'SALE: 메뉴 금액' })
  menuAmount: number;

  @Column('int', { name: 'delivery_tip', comment: 'SALE: 손님이 낸 배달팁' })
  deliveryTip: number;

  @Column('int', { comment: 'SALE: 중개수수료' })
  commission: number;

  @Column('int', { name: 'payment_fee', comment: 'SALE: 결제수수료' })
  paymentFee: number;

  @Column('int', { name: 'delivery_fee', comment: 'SALE: 배달대행료' })
  deliveryFee: number;

  @Column('varchar', { length: 300, nullable: true, comment: '메모' })
  memo: string | null;

  @Column('date', { name: 'payout_due_on', comment: '지급 예정일 (한국 날짜)' })
  payoutDueOn: string;

  @Column('uuid', {
    name: 'payout_id',
    nullable: true,
    comment: '지급했으면 그 지급 (store_payouts.id)',
  })
  payoutId: string | null;

  @Column('timestamptz', { name: 'created_at', comment: '쌓은 시각' })
  createdAt: Date;
}

@Entity({ name: 'store_payouts', comment: '가게에 보낸 정산금' })
@Index('idx_store_payouts_store', ['storeId', 'paidAt'])
export class StorePayoutOrmEntity {
  @PrimaryColumn('uuid', { comment: '지급 ID' })
  id: string;

  @Column('uuid', { name: 'store_id', comment: '가게 (stores.id)' })
  storeId: string;

  @Column('date', {
    name: 'due_on',
    comment: '이 날까지 지급 예정이던 내역을 모았다',
  })
  dueOn: string;

  @Column('int', { comment: '보낸 금액(원)' })
  amount: number;

  @Column('int', { name: 'entry_count', comment: '모은 정산 내역 수' })
  entryCount: number;

  @Column('varchar', { name: 'bank_name', length: 20, comment: '보낸 은행' })
  bankName: string;

  @Column('varchar', {
    name: 'masked_account_number',
    length: 20,
    comment: '보낸 계좌 (끝 네 자리만)',
  })
  maskedAccountNumber: string;

  @Column('varchar', { name: 'account_holder', length: 30, comment: '예금주' })
  accountHolder: string;

  @Column('timestamptz', { name: 'paid_at', comment: '보낸 시각' })
  paidAt: Date;

  @Column('uuid', { name: 'paid_by', comment: '지급 처리한 운영자 (users.id)' })
  paidBy: string;
}

@Entity({ name: 'store_settlement_accounts', comment: '가게 정산 계좌' })
export class StoreSettlementAccountOrmEntity {
  @PrimaryColumn('uuid', { name: 'store_id', comment: '가게 (stores.id)' })
  storeId: string;

  @Column('varchar', { name: 'bank_name', length: 20, comment: '은행' })
  bankName: string;

  @Column('varchar', {
    name: 'account_number',
    length: 16,
    comment: '계좌번호 (숫자만)',
  })
  accountNumber: string;

  @Column('varchar', { name: 'account_holder', length: 30, comment: '예금주' })
  accountHolder: string;

  @Column('timestamptz', {
    name: 'verified_at',
    nullable: true,
    comment: '운영자가 확인한 시각. 계좌를 바꾸면 NULL',
  })
  verifiedAt: Date | null;

  @Column('uuid', {
    name: 'verified_by',
    nullable: true,
    comment: '확인한 운영자 (users.id)',
  })
  verifiedBy: string | null;

  @Column('timestamptz', {
    name: 'updated_at',
    comment: '마지막으로 바꾼 시각',
  })
  updatedAt: Date;
}

@Entity({ name: 'store_settlement_holds', comment: '가게 정산 지급 보류' })
export class StoreSettlementHoldOrmEntity {
  @PrimaryColumn('uuid', { name: 'store_id', comment: '가게 (stores.id)' })
  storeId: string;

  @Column('varchar', { length: 200, comment: '보류 사유' })
  reason: string;

  @Column('timestamptz', { name: 'held_at', comment: '보류한 시각' })
  heldAt: Date;

  @Column('uuid', { name: 'held_by', comment: '보류한 운영자 (users.id)' })
  heldBy: string;
}
