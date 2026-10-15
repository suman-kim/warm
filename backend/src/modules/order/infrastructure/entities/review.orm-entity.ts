import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

/** 평가 ORM 엔티티. 주문 하나에 한 행. */
@Entity({ name: 'reviews', comment: '배송 평가 (고객 → 기사)' })
@Index('uq_reviews_order', ['orderId'], { unique: true })
// 기사의 평균 별점을 구한다.
@Index('idx_reviews_driver', ['driverId'])
export class ReviewOrmEntity {
  @PrimaryColumn('uuid', { comment: '평가 ID' })
  id: string;

  @Column('uuid', { name: 'order_id', comment: 'orders.id' })
  orderId: string;

  @Column('uuid', { name: 'customer_id', comment: 'users.id' })
  customerId: string;

  @Column('uuid', { name: 'driver_id', comment: 'drivers.id' })
  driverId: string;

  @Column('int', { comment: '별점 1~5' })
  rating: number;

  @Column('text', { array: true, comment: 'KIND | FAST | CAREFUL' })
  tags: string[];

  @Column('varchar', { length: 300, nullable: true, comment: '고객이 남긴 말' })
  comment: string | null;

  @Column('timestamptz', { name: 'created_at', comment: '평가한 시각' })
  createdAt: Date;
}
