import { Column, Entity, Index, PrimaryColumn } from 'typeorm';
import { CardType } from '../../domain/entities/payment-method.entity.js';

/** 등록한 카드 ORM 엔티티. 카드 번호는 저장하지 않는다. */
@Entity({ name: 'payment_methods', comment: '고객이 등록한 결제 카드' })
@Index('idx_payment_methods_user', ['userId'])
export class PaymentMethodOrmEntity {
  @PrimaryColumn('uuid', { comment: '카드 ID' })
  id: string;

  @Column('uuid', { name: 'user_id', comment: 'users.id' })
  userId: string;

  @Column('varchar', {
    name: 'billing_key',
    length: 200,
    comment: 'PG사가 발급한 빌링키',
  })
  billingKey: string;

  @Column('varchar', { name: 'card_brand', length: 30, comment: '카드사' })
  cardBrand: string;

  @Column('char', {
    name: 'card_last4',
    length: 4,
    comment: '카드 번호 끝 4자리',
  })
  cardLast4: string;

  @Column('enum', {
    name: 'card_type',
    enum: CardType,
    enumName: 'card_type',
    comment: 'CREDIT(신용) | CHECK(체크)',
  })
  cardType: CardType;

  @Column('boolean', {
    name: 'is_default',
    default: false,
    comment: '기본 카드인지 — 배송을 요청할 때 먼저 선택된다',
  })
  isDefault: boolean;

  @Column('timestamptz', { name: 'created_at', comment: '등록한 시각' })
  createdAt: Date;

  @Column('timestamptz', {
    name: 'removed_at',
    nullable: true,
    comment: '지운 시각. 지난 결제의 영수증 때문에 행은 남긴다.',
  })
  removedAt: Date | null;
}
