import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

/** 주문의 환불 기록 ORM 엔티티. */
@Entity({
  name: 'order_refunds',
  comment: '주문의 환불 기록 (자동 환불·운영자 환불)',
})
@Index('idx_order_refunds_order', ['orderId'])
export class OrderRefundOrmEntity {
  @PrimaryColumn('uuid', { comment: '환불 ID' })
  id: string;

  @Column('uuid', { name: 'order_id', comment: 'orders.id' })
  orderId: string;

  @Column('uuid', { name: 'customer_id', comment: 'users.id' })
  customerId: string;

  @Column('int', { comment: '돌려준 금액(원)' })
  amount: number;

  @Column('varchar', { length: 200, comment: '환불 사유' })
  reason: string;

  @Column('uuid', {
    name: 'refunded_by',
    nullable: true,
    comment: '돌려준 운영자 (users.id). 고객 취소로 자동 환불했으면 null.',
  })
  refundedBy: string | null;

  @Column('timestamptz', { name: 'created_at', comment: '환불한 시각' })
  createdAt: Date;
}
