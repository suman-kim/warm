import { ConflictError } from '../../../../common/domain/domain-error.js';
import { CardType } from './payment-method.entity.js';

/** 주문의 결제 한 건이 무엇인지. */
export enum ChargeKind {
  /** 배차될 때 결제한 요금 */
  DISPATCH = 'DISPATCH',
  /** 픽업할 때 더 결제한 추가 요금과 대기료 */
  ADDITIONAL = 'ADDITIONAL',
}

export enum ChargeStatus {
  PAID = 'PAID',
  FAILED = 'FAILED',
  /** 일부를 돌려줬다 */
  PARTIALLY_CANCELLED = 'PARTIALLY_CANCELLED',
  /** 전부 돌려줬다 */
  CANCELLED = 'CANCELLED',
}

/** 결제할 때의 카드. 나중에 카드를 지워도 영수증에 남는다. */
export interface ChargedCard {
  paymentMethodId: string;
  brand: string;
  last4: string;
  type: CardType;
}

export interface OrderChargeState {
  id: string;
  orderId: string;
  customerId: string;
  kind: ChargeKind;
  amount: number;
  status: ChargeStatus;
  card: ChargedCard;
  /** PG사의 결제 키 (취소할 때 쓴다). 실패했으면 null. */
  paymentKey: string | null;
  approvalNumber: string | null;
  approvedAt: Date | null;
  failureCode: string | null;
  failedAt: Date | null;
  /** 돌려준 금액의 합 */
  cancelledAmount: number;
  cancelledAt: Date | null;
  createdAt: Date;
}

/** 주문의 카드 결제 한 건. 성공했든 실패했든 남긴다. */
export class OrderCharge {
  private constructor(private readonly state: OrderChargeState) {}

  static paid(input: {
    id: string;
    orderId: string;
    customerId: string;
    kind: ChargeKind;
    amount: number;
    card: ChargedCard;
    paymentKey: string;
    approvalNumber: string;
    approvedAt: Date;
  }): OrderCharge {
    return new OrderCharge({
      ...input,
      status: ChargeStatus.PAID,
      failureCode: null,
      failedAt: null,
      cancelledAmount: 0,
      cancelledAt: null,
      createdAt: input.approvedAt,
    });
  }

  static failed(input: {
    id: string;
    orderId: string;
    customerId: string;
    kind: ChargeKind;
    amount: number;
    card: ChargedCard;
    failureCode: string;
    now: Date;
  }): OrderCharge {
    return new OrderCharge({
      id: input.id,
      orderId: input.orderId,
      customerId: input.customerId,
      kind: input.kind,
      amount: input.amount,
      card: input.card,
      status: ChargeStatus.FAILED,
      paymentKey: null,
      approvalNumber: null,
      approvedAt: null,
      failureCode: input.failureCode,
      failedAt: input.now,
      cancelledAmount: 0,
      cancelledAt: null,
      createdAt: input.now,
    });
  }

  static restore(state: OrderChargeState): OrderCharge {
    return new OrderCharge(state);
  }

  get id(): string {
    return this.state.id;
  }

  get kind(): ChargeKind {
    return this.state.kind;
  }

  get status(): ChargeStatus {
    return this.state.status;
  }

  get paymentKey(): string | null {
    return this.state.paymentKey;
  }

  /** 아직 돌려주지 않은, 결제된 금액 */
  get remainingAmount(): number {
    return this.isPaid ? this.state.amount - this.state.cancelledAmount : 0;
  }

  get isPaid(): boolean {
    return (
      this.state.status === ChargeStatus.PAID ||
      this.state.status === ChargeStatus.PARTIALLY_CANCELLED
    );
  }

  /** [amount]만큼 돌려준다. 결제된 만큼까지만. */
  cancel(amount: number, now: Date): void {
    if (!this.isPaid || amount <= 0 || amount > this.remainingAmount) {
      throw new ConflictError(
        'REFUND_EXCEEDS_PAID',
        '결제된 금액보다 많이 돌려줄 수 없어요.',
      );
    }
    this.state.cancelledAmount += amount;
    this.state.cancelledAt = now;
    this.state.status =
      this.state.cancelledAmount === this.state.amount
        ? ChargeStatus.CANCELLED
        : ChargeStatus.PARTIALLY_CANCELLED;
  }

  snapshot(): Readonly<OrderChargeState> {
    return { ...this.state, card: { ...this.state.card } };
  }
}
