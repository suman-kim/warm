import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

/** 주문 메시지 ORM 엔티티. */
@Entity({ name: 'order_messages', comment: '주문 메시지 (고객 ↔ 배차된 기사)' })
@Index('idx_order_messages_order', ['orderId', 'createdAt'])
export class OrderMessageOrmEntity {
  @PrimaryColumn('uuid', { comment: '메시지 ID' })
  id: string;

  @Column('uuid', { name: 'order_id', comment: 'orders.id' })
  orderId: string;

  @Column('uuid', { name: 'sender_user_id', comment: 'users.id' })
  senderUserId: string;

  @Column('varchar', { length: 500, comment: '내용' })
  text: string;

  @Column('timestamptz', { name: 'created_at', comment: '보낸 시각' })
  createdAt: Date;
}
