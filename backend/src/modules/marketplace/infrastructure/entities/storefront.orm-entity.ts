import { Column, Entity, Index, PrimaryColumn } from 'typeorm';
import type {
  DayHours,
  DeliveryTipRule,
  DistanceTipRule,
} from '../../domain/entities/storefront.entity.js';

/** 주문앱(따끈)에 보이는 가게. 가게(stores) 하나에 하나. */
@Entity({
  name: 'storefronts',
  comment: '주문앱(따끈) 가게 운영 설정 — 가게 하나에 하나',
})
@Index('idx_storefronts_category', ['category'])
export class StorefrontOrmEntity {
  @PrimaryColumn('uuid', { name: 'store_id', comment: '가게 (stores.id)' })
  id: string;

  @Column('varchar', {
    length: 20,
    comment:
      '음식 종류 CHICKEN | PIZZA | KOREAN | CHINESE | JAPANESE | WESTERN | SNACK | JOKBAL | CAFE | FAST_FOOD | ASIAN | LUNCHBOX | LATE_NIGHT | OTHER',
  })
  category: string;

  @Column('varchar', { length: 300, nullable: true, comment: '가게 소개' })
  description: string | null;

  @Column('varchar', {
    name: 'origin_notice',
    length: 1000,
    nullable: true,
    comment: '원산지 표시',
  })
  originNotice: string | null;

  @Column('int', {
    name: 'min_order_amount',
    comment: '최소 주문 금액(원) — 메뉴 금액 기준',
  })
  minOrderAmount: number;

  @Column('double precision', {
    name: 'max_delivery_km',
    comment: '배달하는 거리(직선 km)',
  })
  maxDeliveryKm: number;

  @Column('jsonb', {
    name: 'delivery_tip_rules',
    comment:
      '주문금액별 손님 배달팁 [{minOrderAmount, tip}] — 가장 큰 기준을 쓴다',
  })
  deliveryTipRules: DeliveryTipRule[];

  @Column('jsonb', {
    name: 'distance_tip_rules',
    comment: '거리별 추가 배달팁 [{overKm, extra}] — 가장 큰 기준을 쓴다',
  })
  distanceTipRules: DistanceTipRule[];

  @Column('jsonb', {
    name: 'business_hours',
    comment:
      '요일별 영업시간 [일..토] {open, close} (HH:MM, 한국 시간). null이면 쉬는 날',
  })
  businessHours: (DayHours | null)[];

  @Column('jsonb', { comment: '쉬는 날 (한국 날짜 YYYY-MM-DD 목록)' })
  holidays: string[];

  @Column('varchar', {
    name: 'logo_key',
    length: 200,
    nullable: true,
    comment: '대표 사진 (파일 보관소 키)',
  })
  logoKey: string | null;

  @Column('boolean', { comment: '사장님이 주문 받기를 켰는지' })
  open: boolean;

  @Column('timestamptz', {
    name: 'paused_until',
    nullable: true,
    comment: '임시 휴업이 끝나는 시각',
  })
  pausedUntil: Date | null;

  @Column('timestamptz', {
    name: 'hidden_at',
    nullable: true,
    comment: '운영자가 손님 앱에서 내린 시각. 보이면 NULL',
  })
  hiddenAt: Date | null;

  @Column('varchar', {
    name: 'hidden_reason',
    length: 200,
    nullable: true,
    comment: '운영자가 내린 사유',
  })
  hiddenReason: string | null;

  @Column('int', { comment: '낙관적 잠금 버전' })
  version: number;

  @Column('timestamptz', { name: 'created_at', comment: '만든 시각' })
  createdAt: Date;

  @Column('timestamptz', {
    name: 'updated_at',
    comment: '마지막으로 바뀐 시각',
  })
  updatedAt: Date;
}
