import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

@Entity({ name: 'food_order_reviews', comment: '손님 리뷰 (주문 하나에 하나)' })
@Index('idx_food_order_reviews_store', ['storeId', 'createdAt'])
export class ReviewOrmEntity {
  @PrimaryColumn('uuid', { comment: '리뷰 ID' })
  id: string;

  @Index('uq_food_order_reviews_order', { unique: true })
  @Column('uuid', { name: 'food_order_id', comment: '주문 (food_orders.id)' })
  foodOrderId: string;

  @Column('uuid', { name: 'store_id', comment: '가게 (stores.id)' })
  storeId: string;

  @Index('idx_food_order_reviews_consumer')
  @Column('uuid', { name: 'consumer_user_id', comment: '쓴 손님 (users.id)' })
  consumerUserId: string;

  @Column('varchar', {
    name: 'author_name',
    length: 30,
    comment: '보이는 이름 (가운데를 가린다)',
  })
  authorName: string;

  @Column('smallint', { comment: '별점 1~5' })
  rating: number;

  @Column('varchar', { length: 500, nullable: true, comment: '리뷰 글' })
  content: string | null;

  @Column('varchar', {
    name: 'order_summary',
    length: 100,
    comment: '시킨 메뉴 요약',
  })
  orderSummary: string;

  @Column('timestamptz', { name: 'created_at', comment: '쓴 시각' })
  createdAt: Date;
}
