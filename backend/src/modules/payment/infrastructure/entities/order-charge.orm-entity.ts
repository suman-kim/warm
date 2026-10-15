import { Column, Entity, Index, PrimaryColumn } from 'typeorm';
import {
  ChargeKind,
  ChargeStatus,
} from '../../domain/entities/order-charge.entity.js';
import { CardType } from '../../domain/entities/payment-method.entity.js';

/** 주문의 카드 결제 ORM 엔티티. 실패한 결제도 남긴다. */
@Entity({
  name: 'order_charges',
  comment: '주문의 카드 결제 (배차 결제·추가 결제)',
})
@Index('idx_order_charges_order', ['orderId'])
export class OrderChargeOrmEntity {
  @PrimaryColumn('uuid', { comment: '결제 ID' })
  id: string;

  @Column('uuid', { name: 'order_id', comment: 'orders.id' })
  orderId: string;

  @Column('uuid', { name: 'customer_id', comment: 'users.id' })
  customerId: string;

  @Column('enum', {
    enum: ChargeKind,
    enumName: 'charge_kind',
    comment: 'DISPATCH(배차 때 요금) | ADDITIONAL(픽업 때 추가 요금)',
  })
  kind: ChargeKind;

  @Column('int', { comment: '결제하려 한 금액(원)' })
  amount: number;

  @Column('enum', {
    enum: ChargeStatus,
    enumName: 'charge_status',
    comment: 'PAID | FAILED | PARTIALLY_CANCELLED | CANCELLED',
  })
  status: ChargeStatus;

  @Column('uuid', { name: 'payment_method_id', comment: 'payment_methods.id' })
  paymentMethodId: string;

  @Column('varchar', {
    name: 'card_brand',
    length: 30,
    comment: '결제한 카드의 카드사 (결제 당시)',
  })
  cardBrand: string;

  @Column('char', {
    name: 'card_last4',
    length: 4,
    comment: '결제한 카드 번호 끝 4자리',
  })
  cardLast4: string;

  @Column('enum', {
    name: 'card_type',
    enum: CardType,
    enumName: 'card_type',
    comment: 'CREDIT(신용) | CHECK(체크)',
  })
  cardType: CardType;

  @Column('varchar', {
    name: 'payment_key',
    length: 200,
    nullable: true,
    comment: 'PG사의 결제 키 (취소할 때 쓴다)',
  })
  paymentKey: string | null;

  @Column('varchar', {
    name: 'approval_number',
    length: 30,
    nullable: true,
    comment: '카드 승인 번호. 결제가 안 됐으면 NULL',
  })
  approvalNumber: string | null;

  @Column('timestamptz', {
    name: 'approved_at',
    nullable: true,
    comment: '승인된 시각',
  })
  approvedAt: Date | null;

  @Column('varchar', {
    name: 'failure_code',
    length: 40,
    nullable: true,
    comment: 'PaymentFailureCode',
  })
  failureCode: string | null;

  @Column('timestamptz', {
    name: 'failed_at',
    nullable: true,
    comment: '결제가 안 된 시각',
  })
  failedAt: Date | null;

  @Column('int', {
    name: 'cancelled_amount',
    default: 0,
    comment: '돌려준 금액의 합(원)',
  })
  cancelledAmount: number;

  @Column('timestamptz', {
    name: 'cancelled_at',
    nullable: true,
    comment: '마지막으로 취소(환불)한 시각',
  })
  cancelledAt: Date | null;

  @Column('timestamptz', { name: 'created_at', comment: '결제를 시도한 시각' })
  createdAt: Date;
}
