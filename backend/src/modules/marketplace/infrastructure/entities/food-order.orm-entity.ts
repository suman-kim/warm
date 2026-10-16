import {
  Column,
  Entity,
  Index,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { FoodOrderRefund } from '../../domain/entities/food-order.entity.js';
import type { FoodOrderLine } from '../../domain/services/cart-pricing.js';

/** 손님의 음식 주문 (주문앱 따끈). 배달은 orders 표에 따로 있고 delivery_order_id로 잇는다. */
@Entity({ name: 'food_orders', comment: '손님의 음식 주문 (주문앱 따끈)' })
@Index('idx_food_orders_consumer', ['consumerUserId', 'createdAt'])
@Index('idx_food_orders_store', ['storeId', 'createdAt'])
@Index('idx_food_orders_status', ['status', 'paidAt'])
export class FoodOrderOrmEntity {
  @PrimaryColumn('uuid', { comment: '주문 ID' })
  id: string;

  @Column('uuid', {
    name: 'consumer_user_id',
    comment: '주문한 손님 (users.id)',
  })
  consumerUserId: string;

  @Column('uuid', { name: 'store_id', comment: '가게 (stores.id)' })
  storeId: string;

  @Column('uuid', {
    name: 'store_owner_user_id',
    comment: '가게 사장님 (users.id)',
  })
  storeOwnerUserId: string;

  @Column('varchar', {
    name: 'store_name',
    length: 50,
    comment: '주문 당시 가게 이름',
  })
  storeName: string;

  @Column('jsonb', {
    comment:
      '주문 당시 메뉴 [{menuItemId, name, unitPrice, quantity, options, lineTotal}]',
  })
  lines: FoodOrderLine[];

  @Column('int', { name: 'menu_amount', comment: '메뉴 금액 합(원)' })
  menuAmount: number;

  @Column('int', { name: 'delivery_tip', comment: '손님이 낸 배달팁(원)' })
  deliveryTip: number;

  @Column('int', {
    name: 'payment_amount',
    comment: '결제 금액(원) = 메뉴 금액 + 배달팁',
  })
  paymentAmount: number;

  @Column('varchar', {
    name: 'dropoff_address',
    length: 200,
    comment: '배달 주소 (도로명)',
  })
  dropoffAddress: string;

  @Column('varchar', {
    name: 'dropoff_detail_address',
    length: 200,
    nullable: true,
    comment: '배달 상세 주소',
  })
  dropoffDetailAddress: string | null;

  @Column('varchar', {
    name: 'dropoff_sigungu',
    length: 50,
    nullable: true,
    comment: '배달 주소 시·군·구',
  })
  dropoffSigungu: string | null;

  @Column('varchar', {
    name: 'dropoff_dong',
    length: 50,
    nullable: true,
    comment: '배달 주소 동',
  })
  dropoffDong: string | null;

  @Column('double precision', {
    name: 'dropoff_latitude',
    comment: '배달 주소 위도',
  })
  dropoffLatitude: number;

  @Column('double precision', {
    name: 'dropoff_longitude',
    comment: '배달 주소 경도',
  })
  dropoffLongitude: number;

  @Column('varchar', {
    name: 'consumer_phone',
    length: 12,
    comment: '손님 연락처 (숫자만)',
  })
  consumerPhone: string;

  @Column('double precision', {
    name: 'distance_km',
    comment: '가게에서 손님까지 직선 거리(km)',
  })
  distanceKm: number;

  @Column('varchar', {
    name: 'store_request',
    length: 200,
    nullable: true,
    comment: '가게 요청사항',
  })
  storeRequest: string | null;

  @Column('varchar', {
    name: 'rider_request',
    length: 200,
    nullable: true,
    comment: '라이더 요청사항',
  })
  riderRequest: string | null;

  @Column('boolean', { name: 'disposable_cutlery', comment: '수저·포크 받기' })
  disposableCutlery: boolean;

  @Column('double precision', {
    name: 'commission_rate_percent',
    comment: '주문 당시 중개수수료율(%) — 메뉴 금액에 붙는다',
  })
  commissionRatePercent: number;

  @Column('double precision', {
    name: 'payment_fee_rate_percent',
    comment: '주문 당시 결제수수료율(%) — 결제 금액에 붙는다',
  })
  paymentFeeRatePercent: number;

  @Column('varchar', {
    length: 20,
    comment:
      'PENDING_PAYMENT | PLACED | ACCEPTED | PICKED_UP | DELIVERED | REJECTED | CANCELLED',
  })
  status: string;

  @Index('uq_food_orders_payment', { unique: true })
  @Column('varchar', { name: 'payment_id', length: 64, comment: 'PG 결제 ID' })
  paymentId: string;

  @Column('timestamptz', {
    name: 'paid_at',
    nullable: true,
    comment: '결제를 확인한 시각',
  })
  paidAt: Date | null;

  @Column('int', {
    name: 'cook_minutes',
    nullable: true,
    comment: '가게가 정한 조리 시간(분)',
  })
  cookMinutes: number | null;

  @Column('timestamptz', {
    name: 'accepted_at',
    nullable: true,
    comment: '가게가 받은 시각',
  })
  acceptedAt: Date | null;

  @Index('uq_food_orders_delivery', { unique: true })
  @Column('uuid', {
    name: 'delivery_order_id',
    nullable: true,
    comment: '가게가 받으면 요청한 배달 (orders.id)',
  })
  deliveryOrderId: string | null;

  @Column('timestamptz', {
    name: 'picked_up_at',
    nullable: true,
    comment: '라이더가 픽업한 시각',
  })
  pickedUpAt: Date | null;

  @Column('timestamptz', {
    name: 'delivered_at',
    nullable: true,
    comment: '배달을 끝낸 시각',
  })
  deliveredAt: Date | null;

  @Column('timestamptz', {
    name: 'rejected_at',
    nullable: true,
    comment: '가게가 거절한 시각',
  })
  rejectedAt: Date | null;

  @Column('varchar', {
    name: 'reject_reason',
    length: 200,
    nullable: true,
    comment: '거절 사유',
  })
  rejectReason: string | null;

  @Column('timestamptz', {
    name: 'cancelled_at',
    nullable: true,
    comment: '취소된 시각',
  })
  cancelledAt: Date | null;

  @Column('varchar', {
    name: 'cancel_reason',
    length: 500,
    nullable: true,
    comment: '취소 사유',
  })
  cancelReason: string | null;

  @Column('varchar', {
    name: 'cancelled_by',
    length: 10,
    nullable: true,
    comment: '취소한 쪽 CONSUMER | STORE | ADMIN',
  })
  cancelledBy: string | null;

  @Column('jsonb', {
    comment:
      '환불 [{id, amount, reason, borneBy, refundedBy, refundedAt, status(PENDING|DONE|FAILED), completedAt, failureReason}]',
  })
  refunds: FoodOrderRefund[];

  @Column('int', { comment: '낙관적 잠금 버전' })
  version: number;

  @Column('timestamptz', { name: 'created_at', comment: '주문을 만든 시각' })
  createdAt: Date;

  @UpdateDateColumn({
    name: 'updated_at',
    type: 'timestamptz',
    comment: '마지막으로 바뀐 시각',
  })
  updatedAt: Date;
}
