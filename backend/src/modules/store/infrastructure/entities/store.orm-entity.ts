import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

/** 가게 ORM 엔티티. */
@Entity({ name: 'stores', comment: '가게 (배달을 요청하는 음식점)' })
@Index('idx_stores_status', ['status', 'appliedAt'])
export class StoreOrmEntity {
  @PrimaryColumn('uuid', { comment: '가게 ID' })
  id: string;

  @Column('uuid', {
    name: 'owner_user_id',
    unique: true,
    comment: '사장님 회원 ID (users.id) — 회원 한 명에 가게 하나',
  })
  ownerUserId: string;

  @Column('varchar', { length: 50, comment: '상호' })
  name: string;

  @Column('varchar', {
    name: 'business_number',
    length: 10,
    comment: '사업자등록번호 (숫자 10자리)',
  })
  businessNumber: string;

  @Column('varchar', { length: 20, comment: '가게 전화번호 (숫자만)' })
  phone: string;

  @Column('varchar', { length: 200, comment: '가게 주소 (픽업지)' })
  address: string;

  @Column('varchar', {
    name: 'detail_address',
    length: 200,
    nullable: true,
    comment: '상세 주소',
  })
  detailAddress: string | null;

  @Column('varchar', { length: 50, comment: '시군구' })
  sigungu: string;

  @Column('varchar', { length: 50, comment: '동' })
  dong: string;

  @Column('double precision', { comment: '위도' })
  latitude: number;

  @Column('double precision', { comment: '경도' })
  longitude: number;

  @Column('varchar', {
    length: 20,
    comment: '심사 상태: PENDING | APPROVED | REJECTED',
  })
  status: string;

  @Column('varchar', {
    name: 'rejection_reason',
    length: 500,
    nullable: true,
    comment: '반려 사유',
  })
  rejectionReason: string | null;

  @Column('int', {
    name: 'wallet_balance',
    comment: '충전금 잔액 (원) — store_wallet_entries의 마지막 잔액과 같다',
  })
  walletBalance: number;

  @Column('timestamptz', { name: 'applied_at', comment: '심사를 신청한 시각' })
  appliedAt: Date;

  @Column('timestamptz', {
    name: 'reviewed_at',
    nullable: true,
    comment: '승인·반려한 시각',
  })
  reviewedAt: Date | null;

  @Column('uuid', {
    name: 'reviewed_by',
    nullable: true,
    comment: '승인·반려한 운영자 (users.id)',
  })
  reviewedBy: string | null;

  @Column('timestamptz', { name: 'created_at', comment: '등록한 시각' })
  createdAt: Date;

  @Column('int', {
    comment: '낙관적 잠금 버전 — 충전금이 동시에 바뀌어도 꼬이지 않게',
  })
  version: number;
}

/** 충전금 내역 ORM 엔티티. */
@Entity({
  name: 'store_wallet_entries',
  comment: '가게 충전금 내역 (충전·대행료 차감·환불·조정)',
})
@Index('idx_store_wallet_entries_store', ['storeId', 'createdAt'])
export class WalletEntryOrmEntity {
  @PrimaryColumn('uuid', { comment: '내역 ID' })
  id: string;

  @Column('uuid', { name: 'store_id', comment: 'stores.id' })
  storeId: string;

  @Column('varchar', {
    length: 20,
    comment: '종류: TOP_UP | DELIVERY_FEE | REFUND | ADJUSTMENT',
  })
  kind: string;

  @Column('int', { comment: '금액 (원) — 늘면 +, 줄면 -' })
  amount: number;

  @Column('int', { name: 'balance_after', comment: '이 내역 뒤 잔액 (원)' })
  balanceAfter: number;

  @Column('uuid', {
    name: 'order_id',
    nullable: true,
    comment: '관련 배달 (orders.id)',
  })
  orderId: string | null;

  @Column('varchar', {
    length: 200,
    nullable: true,
    comment: '메모 (조정·환불 사유)',
  })
  memo: string | null;

  @Column('uuid', {
    name: 'created_by',
    nullable: true,
    comment: '조정한 운영자 (users.id)',
  })
  createdBy: string | null;

  @Column('timestamptz', { name: 'created_at', comment: '생긴 시각' })
  createdAt: Date;
}
