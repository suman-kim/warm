import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

/** 주문 ORM 엔티티. 픽업지·도착지·화물 값 객체는 칸으로 펼쳐 담는다. */
@Entity({ name: 'orders', comment: '주문 (배송 요청)' })
// 기사의 배차 대기 주문 조회: status = REQUESTED AND vehicle_type = ? ORDER BY requested_at DESC
@Index('idx_orders_open', ['status', 'vehicleType', 'requestedAt'])
@Index('idx_orders_customer', ['customerId', 'requestedAt'])
@Index('idx_orders_driver', ['driverId', 'requestedAt'])
export class OrderOrmEntity {
  @PrimaryColumn('uuid', { comment: '주문 ID' })
  id: string;

  @Column('uuid', { name: 'customer_id', comment: 'users.id' })
  customerId: string;

  @Column('uuid', { name: 'driver_id', nullable: true, comment: 'drivers.id' })
  driverId: string | null;

  @Column('varchar', {
    name: 'service_type',
    length: 20,
    comment: 'QUICK(퀵배송) | FREIGHT(화물)',
  })
  serviceType: string;

  @Column('varchar', {
    name: 'vehicle_type',
    length: 20,
    comment:
      '차종: MOTORCYCLE | DAMAS | LABO | TRUCK_1T | TRUCK_2_5T | TRUCK_5T',
  })
  vehicleType: string;

  @Column('varchar', {
    length: 20,
    comment:
      'REQUESTED | PAYING | PAYMENT_FAILED | ASSIGNED | DEPARTED | ARRIVED | PICKED_UP | DELIVERED | CANCELLED | NO_SHOW',
  })
  status: string;

  @Column('varchar', {
    name: 'pickup_address',
    length: 200,
    comment: '출발지 주소 (도로명)',
  })
  pickupAddress: string;

  @Column('varchar', {
    name: 'pickup_detail_address',
    length: 200,
    nullable: true,
    comment: '출발지 상세 주소 (건물·동·호수)',
  })
  pickupDetailAddress: string | null;

  @Column('varchar', {
    name: 'pickup_sigungu',
    length: 50,
    nullable: true,
    comment: '출발지 시·군·구 — 수락 전 기사에게 보인다',
  })
  pickupSigungu: string | null;

  @Column('varchar', {
    name: 'pickup_dong',
    length: 50,
    nullable: true,
    comment: '출발지 동 — 수락 전 기사에게 보인다',
  })
  pickupDong: string | null;

  @Column('double precision', {
    name: 'pickup_latitude',
    comment: '출발지 위도',
  })
  pickupLatitude: number;

  @Column('double precision', {
    name: 'pickup_longitude',
    comment: '출발지 경도',
  })
  pickupLongitude: number;

  @Column('varchar', {
    name: 'pickup_contact_name',
    length: 50,
    comment: '출발지에서 물품을 넘겨줄 사람',
  })
  pickupContactName: string;

  @Column('varchar', {
    name: 'pickup_contact_phone',
    length: 11,
    comment: '출발지 연락처 (숫자만)',
  })
  pickupContactPhone: string;

  @Column('varchar', {
    name: 'dropoff_address',
    length: 200,
    comment: '도착지 주소 (도로명)',
  })
  dropoffAddress: string;

  @Column('varchar', {
    name: 'dropoff_detail_address',
    length: 200,
    nullable: true,
    comment: '도착지 상세 주소 (건물·동·호수)',
  })
  dropoffDetailAddress: string | null;

  @Column('varchar', {
    name: 'dropoff_sigungu',
    length: 50,
    nullable: true,
    comment: '도착지 시·군·구 — 수락 전 기사에게 보인다',
  })
  dropoffSigungu: string | null;

  @Column('varchar', {
    name: 'dropoff_dong',
    length: 50,
    nullable: true,
    comment: '도착지 동 — 수락 전 기사에게 보인다',
  })
  dropoffDong: string | null;

  @Column('double precision', {
    name: 'dropoff_latitude',
    comment: '도착지 위도',
  })
  dropoffLatitude: number;

  @Column('double precision', {
    name: 'dropoff_longitude',
    comment: '도착지 경도',
  })
  dropoffLongitude: number;

  @Column('varchar', {
    name: 'dropoff_contact_name',
    length: 50,
    comment: '도착지에서 물품을 받을 사람',
  })
  dropoffContactName: string;

  @Column('varchar', {
    name: 'dropoff_contact_phone',
    length: 11,
    comment: '도착지 연락처 (숫자만)',
  })
  dropoffContactPhone: string;

  @Column('varchar', {
    name: 'cargo_category',
    length: 30,
    comment: 'DOCUMENT | BOX | SHOPPING_BAG | FURNITURE_APPLIANCE | ETC',
  })
  cargoCategory: string;

  @Column('varchar', {
    name: 'cargo_description',
    length: 200,
    nullable: true,
    comment: '물품 설명',
  })
  cargoDescription: string | null;

  @Column('double precision', {
    name: 'cargo_weight_kg',
    comment: '물품 무게(kg)',
  })
  cargoWeightKg: number;

  @Column('int', { name: 'cargo_quantity', comment: '물품 개수' })
  cargoQuantity: number;

  @Column('varchar', { length: 500, nullable: true, comment: '요청 사항' })
  memo: string | null;

  @Column('double precision', {
    name: 'distance_km',
    comment: '운행 거리(km) — 출발지에서 도착지까지',
  })
  distanceKm: number;

  @Column('int', { name: 'duration_minutes', comment: '예상 소요 시간(분)' })
  durationMinutes: number;

  @Column('int', { name: 'base_fare', comment: '기본 요금(원) — 차종과 거리' })
  baseFare: number;

  @Column('varchar', {
    name: 'loading_help',
    length: 20,
    default: 'NONE',
    comment: '큰 짐 운반 도움: NONE | TOGETHER | DRIVER_ONLY',
  })
  loadingHelp: string;

  @Column('int', {
    name: 'help_fee',
    default: 0,
    comment: '운반 도움 요금(원)',
  })
  helpFee: number;

  @Column('smallint', {
    name: 'pickup_floor',
    default: 1,
    comment: '출발지 층',
  })
  pickupFloor: number;

  @Column('boolean', {
    name: 'pickup_elevator',
    default: true,
    comment: '출발지에 엘리베이터가 있는지',
  })
  pickupElevator: boolean;

  @Column('smallint', {
    name: 'dropoff_floor',
    default: 1,
    comment: '도착지 층',
  })
  dropoffFloor: number;

  @Column('boolean', {
    name: 'dropoff_elevator',
    default: true,
    comment: '도착지에 엘리베이터가 있는지',
  })
  dropoffElevator: boolean;

  @Column('int', {
    name: 'stair_fee',
    default: 0,
    comment: '엘리베이터 없는 층의 계단 요금(원)',
  })
  stairFee: number;

  @Column('int', {
    name: 'fare_amount',
    comment: '배차 때 결제하는 요금(원) = 기본 요금 + 운반 도움 + 계단',
  })
  fareAmount: number;

  @Column('uuid', {
    name: 'payment_method_id',
    nullable: true,
    comment: '결제할 카드 (payment_methods.id)',
  })
  paymentMethodId: string | null;

  @Column('smallint', {
    name: 'extra_overload',
    default: 0,
    comment: '과적 단계',
  })
  extraOverload: number;

  @Column('smallint', {
    name: 'extra_bulky',
    default: 0,
    comment: '큰 짐 개수',
  })
  extraBulky: number;

  @Column('smallint', {
    name: 'extra_stairs',
    default: 0,
    comment: '엘리베이터 없이 오른 층 (기사가 넣은 것)',
  })
  extraStairs: number;

  @Column('int', {
    name: 'extra_fee',
    default: 0,
    comment: '기사가 픽업할 때 넣은 추가 요금(원)',
  })
  extraFee: number;

  @Column('int', {
    name: 'waiting_minutes',
    default: 0,
    comment: '기사가 출발지에 도착한 뒤 픽업까지 기다린 시간(분)',
  })
  waitingMinutes: number;

  @Column('int', { name: 'waiting_fee', default: 0, comment: '대기료(원)' })
  waitingFee: number;

  @Column('int', {
    name: 'cancellation_fee',
    default: 0,
    comment: '취소 수수료 또는 노쇼 요금(원)',
  })
  cancellationFee: number;

  @Column('varchar', {
    name: 'payment_failure_code',
    length: 40,
    nullable: true,
    comment: '배차 때 결제가 안 된 사유 (PaymentFailureCode)',
  })
  paymentFailureCode: string | null;

  @Column('timestamptz', {
    name: 'scheduled_pickup_at',
    nullable: true,
    comment: '고객이 정한 픽업 시각 (예약). 바로 출발이면 NULL',
  })
  scheduledPickupAt: Date | null;

  @Column('timestamptz', {
    name: 'estimated_pickup_at',
    nullable: true,
    comment: '배차 때 계산한 픽업 예정 시각',
  })
  estimatedPickupAt: Date | null;

  @Column('timestamptz', {
    name: 'requested_at',
    comment: '배송을 요청한 시각',
  })
  requestedAt: Date;

  @Column('timestamptz', {
    name: 'assigned_at',
    nullable: true,
    comment: '배차가 확정된 시각 (기사가 수락하고 결제가 된 시각)',
  })
  assignedAt: Date | null;

  @Column('timestamptz', {
    name: 'departed_at',
    nullable: true,
    comment: '기사가 출발지로 출발한 시각',
  })
  departedAt: Date | null;

  @Column('timestamptz', {
    name: 'arrived_at',
    nullable: true,
    comment: '기사가 출발지에 도착한 시각',
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
    comment: '배송을 끝낸 시각',
  })
  deliveredAt: Date | null;

  @Column('timestamptz', {
    name: 'cancelled_at',
    nullable: true,
    comment: '취소된 시각',
  })
  cancelledAt: Date | null;

  @Column('timestamptz', {
    name: 'no_show_at',
    nullable: true,
    comment: '기사가 노쇼를 신고한 시각',
  })
  noShowAt: Date | null;
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
