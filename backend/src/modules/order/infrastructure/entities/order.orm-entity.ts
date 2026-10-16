import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

/** 배달(주문) ORM 엔티티. 가게(픽업지)·손님(도착지) 값 객체는 칸으로 펼쳐 담는다. */
@Entity({ name: 'orders', comment: '배달 (가게가 요청한 음식 배달)' })
// 라이더의 콜 목록: status = REQUESTED ORDER BY requested_at DESC
@Index('idx_orders_open', ['status', 'requestedAt'])
@Index('idx_orders_customer', ['customerId', 'requestedAt'])
@Index('idx_orders_driver', ['driverId', 'requestedAt'])
export class OrderOrmEntity {
  @PrimaryColumn('uuid', { comment: '주문 ID' })
  id: string;

  @Column('uuid', { name: 'customer_id', comment: '요청한 사장님 (users.id)' })
  customerId: string;

  @Column('uuid', { name: 'driver_id', nullable: true, comment: 'drivers.id' })
  driverId: string | null;

  @Column('varchar', {
    length: 20,
    comment:
      'REQUESTED | ASSIGNED | DEPARTED | ARRIVED | PICKED_UP | DELIVERED | CANCELLED',
  })
  status: string;

  @Index('idx_orders_store')
  @Column('uuid', {
    name: 'store_id',
    comment: '배달을 요청한 가게 (stores.id)',
  })
  storeId: string;

  @Column('varchar', {
    length: 20,
    default: 'STORE_REQUEST',
    comment:
      '어디서 온 배달인지 STORE_REQUEST(가게가 직접 요청) | FOOD_ORDER(주문앱 따끈 주문)',
  })
  source: string;

  @Index('idx_orders_source_order')
  @Column('uuid', {
    name: 'source_order_id',
    nullable: true,
    comment: '주문앱 주문에서 왔으면 그 주문 (food_orders.id)',
  })
  sourceOrderId: string | null;

  @Column('varchar', {
    name: 'pickup_address',
    length: 200,
    comment: '가게(픽업지) 주소 (도로명)',
  })
  pickupAddress: string;

  @Column('varchar', {
    name: 'pickup_detail_address',
    length: 200,
    nullable: true,
    comment: '가게(픽업지) 상세 주소 (건물·동·호수)',
  })
  pickupDetailAddress: string | null;

  @Column('varchar', {
    name: 'pickup_sigungu',
    length: 50,
    nullable: true,
    comment: '가게(픽업지) 시·군·구 — 수락 전 라이더에게 보인다',
  })
  pickupSigungu: string | null;

  @Column('varchar', {
    name: 'pickup_dong',
    length: 50,
    nullable: true,
    comment: '가게(픽업지) 동 — 수락 전 라이더에게 보인다',
  })
  pickupDong: string | null;

  @Column('double precision', {
    name: 'pickup_latitude',
    comment: '가게(픽업지) 위도',
  })
  pickupLatitude: number;

  @Column('double precision', {
    name: 'pickup_longitude',
    comment: '가게(픽업지) 경도',
  })
  pickupLongitude: number;

  @Column('varchar', {
    name: 'pickup_contact_name',
    length: 50,
    comment: '가게 이름',
  })
  pickupContactName: string;

  @Column('varchar', {
    name: 'pickup_contact_phone',
    length: 12,
    comment: '가게(픽업지) 연락처 (숫자만, 안심번호는 12자리)',
  })
  pickupContactPhone: string;

  @Column('varchar', {
    name: 'dropoff_address',
    length: 200,
    comment: '손님(도착지) 주소 (도로명)',
  })
  dropoffAddress: string;

  @Column('varchar', {
    name: 'dropoff_detail_address',
    length: 200,
    nullable: true,
    comment: '손님(도착지) 상세 주소 (건물·동·호수)',
  })
  dropoffDetailAddress: string | null;

  @Column('varchar', {
    name: 'dropoff_sigungu',
    length: 50,
    nullable: true,
    comment: '손님(도착지) 시·군·구 — 수락 전 라이더에게 보인다',
  })
  dropoffSigungu: string | null;

  @Column('varchar', {
    name: 'dropoff_dong',
    length: 50,
    nullable: true,
    comment: '손님(도착지) 동 — 수락 전 라이더에게 보인다',
  })
  dropoffDong: string | null;

  @Column('double precision', {
    name: 'dropoff_latitude',
    comment: '손님(도착지) 위도',
  })
  dropoffLatitude: number;

  @Column('double precision', {
    name: 'dropoff_longitude',
    comment: '손님(도착지) 경도',
  })
  dropoffLongitude: number;

  @Column('varchar', {
    name: 'dropoff_contact_name',
    length: 50,
    comment: '손님 (이름 대신 "손님")',
  })
  dropoffContactName: string;

  @Column('varchar', {
    name: 'dropoff_contact_phone',
    length: 12,
    comment: '손님(도착지) 연락처 (숫자만, 안심번호는 12자리)',
  })
  dropoffContactPhone: string;

  @Column('varchar', {
    length: 500,
    nullable: true,
    comment: '요청 사항 (라이더에게 남길 말)',
  })
  memo: string | null;

  @Column('double precision', {
    name: 'distance_km',
    comment: '운행 거리(km) — 가게에서 손님까지',
  })
  distanceKm: number;

  @Column('int', { name: 'duration_minutes', comment: '예상 소요 시간(분)' })
  durationMinutes: number;

  @Column('int', {
    name: 'fare_amount',
    comment: '배달대행료(원) — 요청할 때 가게 충전금에서 빠진다',
  })
  fareAmount: number;

  @Column('int', {
    name: 'cancellation_fee',
    default: 0,
    comment: '취소 수수료(원) — 라이더 출발·도착 뒤 취소하면 대행료의 15%',
  })
  cancellationFee: number;

  @Column('int', {
    name: 'food_amount',
    comment: '손님이 낼 음식값(원)',
  })
  foodAmount: number;

  @Column('varchar', {
    name: 'door_payment',
    length: 10,
    comment: '음식값을 받는 방식 PREPAID(선결제) | CASH | CARD (만나서 결제)',
  })
  doorPayment: string;

  @Column('varchar', {
    name: 'collected_method',
    length: 10,
    nullable: true,
    comment: '라이더가 손님에게 실제로 받은 방식 CASH | CARD',
  })
  collectedMethod: string | null;

  @Column('int', {
    name: 'collected_amount',
    nullable: true,
    comment: '라이더가 손님에게 실제로 받은 금액(원)',
  })
  collectedAmount: number | null;

  @Column('timestamptz', {
    name: 'cash_handed_at',
    nullable: true,
    comment:
      '라이더가 받은 현금을 가게에 넘긴 시각 (운영자가 확인). 아직이면 NULL',
  })
  cashHandedAt: Date | null;

  @Column('timestamptz', {
    name: 'ready_at',
    nullable: true,
    comment: '조리가 끝나 픽업할 수 있는 시각. 바로면 NULL',
  })
  readyAt: Date | null;

  @Column('timestamptz', {
    name: 'estimated_pickup_at',
    nullable: true,
    comment: '배차 때 계산한 픽업 예정 시각',
  })
  estimatedPickupAt: Date | null;

  @Column('timestamptz', {
    name: 'requested_at',
    comment: '배달을 요청한 시각',
  })
  requestedAt: Date;

  @Column('timestamptz', {
    name: 'assigned_at',
    nullable: true,
    comment: '라이더가 수락한 시각',
  })
  assignedAt: Date | null;

  @Column('timestamptz', {
    name: 'departed_at',
    nullable: true,
    comment: '라이더가 가게로 출발한 시각',
  })
  departedAt: Date | null;

  @Column('timestamptz', {
    name: 'arrived_at',
    nullable: true,
    comment: '라이더가 가게에 도착한 시각',
  })
  arrivedAt: Date | null;

  @Column('timestamptz', {
    name: 'picked_up_at',
    nullable: true,
    comment: '픽업한 시각',
  })
  pickedUpAt: Date | null;

  @Column('timestamptz', {
    name: 'delivered_at',
    nullable: true,
    comment: '배달을 끝낸 시각',
  })
  deliveredAt: Date | null;

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

  @Column('int', { comment: '낙관적 잠금 버전' })
  version: number;

  @CreateDateColumn({
    name: 'created_at',
    type: 'timestamptz',
    comment: '만든 시각',
  })
  createdAt: Date;

  @UpdateDateColumn({
    name: 'updated_at',
    type: 'timestamptz',
    comment: '마지막으로 바뀐 시각',
  })
  updatedAt: Date;
}
