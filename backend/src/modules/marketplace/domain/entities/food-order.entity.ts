import { AggregateRoot } from '../../../../common/domain/aggregate-root.js';
import {
  ConflictError,
  ForbiddenError,
  InvalidArgumentError,
} from '../../../../common/domain/domain-error.js';
import { kstDateString } from '../../../../common/domain/kst.js';
import {
  FoodOrderAcceptedEvent,
  FoodOrderCancelledEvent,
  FoodOrderDeliveredEvent,
  FoodOrderPickedUpEvent,
  FoodOrderPlacedEvent,
  FoodOrderRejectedEvent,
} from '../events/food-order.events.js';
import { FoodOrderLine } from '../services/cart-pricing.js';

/**
 * 주문 상태.
 * PENDING_PAYMENT → (결제) PLACED → (가게 접수) ACCEPTED → PICKED_UP → DELIVERED.
 * 가게가 받지 않으면 REJECTED, 취소하면 CANCELLED (둘 다 전액 환불).
 */
export enum FoodOrderStatus {
  /** 주문을 만들었고 결제를 기다린다 */
  PENDING_PAYMENT = 'PENDING_PAYMENT',
  /** 결제했다 — 가게가 확인 중 */
  PLACED = 'PLACED',
  /** 가게가 받았다 — 조리 중, 배달을 요청했다 */
  ACCEPTED = 'ACCEPTED',
  PICKED_UP = 'PICKED_UP',
  DELIVERED = 'DELIVERED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED',
}

/** 누가 취소했는지. */
export enum FoodOrderCanceller {
  CONSUMER = 'CONSUMER',
  STORE = 'STORE',
  ADMIN = 'ADMIN',
}

/** 부분 환불의 금액을 누가 떠안는지. */
export enum RefundBearer {
  /** 가게 정산에서 뺀다 */
  STORE = 'STORE',
  /** 플랫폼이 낸다 */
  PLATFORM = 'PLATFORM',
}

/** 환불의 진행 상태. 주문 상태를 먼저 저장하고 PG에 돌려 달라고 하므로 그사이가 있다. */
export enum RefundStatus {
  /** 저장했고 PG에 요청하기 전 */
  PENDING = 'PENDING',
  DONE = 'DONE',
  /** PG가 거절했다 — 운영자가 다시 시도한다 */
  FAILED = 'FAILED',
}

/** 손님에게 돌려준(돌려줄) 한 건. */
export interface FoodOrderRefund {
  id: string;
  amount: number;
  reason: string;
  /** 부분 환불이면 누가 떠안는지. 취소·거절로 전부 돌려줬으면 null. */
  borneBy: RefundBearer | null;
  /** 돌려준 운영자 (회원 ID). 취소·거절로 자동 환불했으면 null. */
  refundedBy: string | null;
  refundedAt: Date;
  status: RefundStatus;
  /** PG가 돌려준 시각 */
  completedAt: Date | null;
  /** 마지막으로 실패한 이유 */
  failureReason: string | null;
}

/** 손님 (도착지). */
export interface FoodOrderDestination {
  address: string;
  detailAddress: string | null;
  sigungu: string | null;
  dong: string | null;
  latitude: number;
  longitude: number;
}

export interface FoodOrderState {
  id: string;
  consumerUserId: string;
  storeId: string;
  storeOwnerUserId: string;
  storeName: string;
  lines: FoodOrderLine[];
  /** 메뉴 금액 합 */
  menuAmount: number;
  /** 손님이 낸 배달팁 */
  deliveryTip: number;
  /** 손님이 결제하는 금액 = 메뉴 금액 + 배달팁 */
  paymentAmount: number;
  dropoff: FoodOrderDestination;
  /** 손님 연락처 (숫자만) */
  consumerPhone: string;
  /** 가게에서 손님까지 직선 거리(km) */
  distanceKm: number;
  /** 가게에 남긴 말 */
  storeRequest: string | null;
  /** 라이더에게 남긴 말 */
  riderRequest: string | null;
  /** 수저·포크 받기 */
  disposableCutlery: boolean;
  /** 주문 당시의 정책 — 나중에 정책을 바꿔도 이 주문의 정산은 그대로다 */
  commissionRatePercent: number;
  paymentFeeRatePercent: number;
  status: FoodOrderStatus;
  /** PG사 결제 ID */
  paymentId: string;
  paidAt: Date | null;
  /** 가게가 정한 조리 시간(분) */
  cookMinutes: number | null;
  acceptedAt: Date | null;
  /** 가게가 받으면 요청한 배달 (orders.id) */
  deliveryOrderId: string | null;
  pickedUpAt: Date | null;
  deliveredAt: Date | null;
  rejectedAt: Date | null;
  rejectReason: string | null;
  cancelledAt: Date | null;
  cancelReason: string | null;
  cancelledBy: FoodOrderCanceller | null;
  refunds: FoodOrderRefund[];
  createdAt: Date;
}

export type PlaceFoodOrderInput = Omit<
  FoodOrderState,
  | 'paymentAmount'
  | 'status'
  | 'paidAt'
  | 'cookMinutes'
  | 'acceptedAt'
  | 'deliveryOrderId'
  | 'pickedUpAt'
  | 'deliveredAt'
  | 'rejectedAt'
  | 'rejectReason'
  | 'cancelledAt'
  | 'cancelReason'
  | 'cancelledBy'
  | 'refunds'
>;

const MAX_REQUEST_LENGTH = 200;
const MAX_COOK_MINUTES = 120;

/**
 * 손님의 음식 주문 (주문앱 따끈). 결제 → 가게 접수 → 배달 → 완료의 상태 전이와 환불 금액을 지킨다.
 * 배달 자체는 배달 컨텍스트가 맡고, 이 주문은 그 배달의 ID만 안다.
 */
export class FoodOrder extends AggregateRoot {
  private constructor(
    private readonly state: FoodOrderState,
    version: number,
  ) {
    super(state.id, version);
  }

  static place(input: PlaceFoodOrderInput): FoodOrder {
    const storeRequest = request(input.storeRequest, '가게 요청사항');
    const riderRequest = request(input.riderRequest, '라이더 요청사항');
    if (input.lines.length === 0 || input.menuAmount <= 0) {
      throw new InvalidArgumentError('EMPTY_CART', '메뉴를 담아 주세요.');
    }
    return new FoodOrder(
      {
        ...structuredClone(input),
        storeRequest,
        riderRequest,
        paymentAmount: input.menuAmount + input.deliveryTip,
        status: FoodOrderStatus.PENDING_PAYMENT,
        paidAt: null,
        cookMinutes: null,
        acceptedAt: null,
        deliveryOrderId: null,
        pickedUpAt: null,
        deliveredAt: null,
        rejectedAt: null,
        rejectReason: null,
        cancelledAt: null,
        cancelReason: null,
        cancelledBy: null,
        refunds: [],
      },
      0,
    );
  }

  static restore(state: FoodOrderState, version: number): FoodOrder {
    return new FoodOrder(structuredClone(state), version);
  }

  /** 주문번호 (예: TK261015-3F9A). 가게와 손님이 전화로 말한다. */
  get code(): string {
    const date = kstDateString(this.state.createdAt)
      .slice(2)
      .replaceAll('-', '');
    return `TK${date}-${this.state.id.replaceAll('-', '').slice(0, 4).toUpperCase()}`;
  }

  get status(): FoodOrderStatus {
    return this.state.status;
  }

  get storeId(): string {
    return this.state.storeId;
  }

  get consumerUserId(): string {
    return this.state.consumerUserId;
  }

  get paymentId(): string {
    return this.state.paymentId;
  }

  get deliveryOrderId(): string | null {
    return this.state.deliveryOrderId;
  }

  get isPaid(): boolean {
    return this.state.paidAt !== null;
  }

  /** 아직 돌려줄 수 있는 금액 (결제 금액 − 이미 돌려준 금액) */
  get refundableAmount(): number {
    if (!this.isPaid) return 0;
    return (
      this.state.paymentAmount -
      this.state.refunds.reduce((sum, refund) => sum + refund.amount, 0)
    );
  }

  /** PG에 아직 요청하지 않았거나 실패한 환불 */
  get unsettledRefunds(): FoodOrderRefund[] {
    return this.state.refunds
      .filter((refund) => refund.status !== RefundStatus.DONE)
      .map((refund) => ({ ...refund }));
  }

  /** PG가 아는, 지금 돌려줄 수 있는 금액 (결제 금액 − PG가 이미 돌려준 금액) */
  get gatewayCancellableAmount(): number {
    if (!this.isPaid) return 0;
    return (
      this.state.paymentAmount -
      this.state.refunds
        .filter((refund) => refund.status === RefundStatus.DONE)
        .reduce((sum, refund) => sum + refund.amount, 0)
    );
  }

  snapshot(): FoodOrderState {
    return structuredClone(this.state);
  }

  /** PG가 환불을 마쳤다. */
  completeRefund(refundId: string, now: Date): void {
    const refund = this.refund(refundId);
    refund.status = RefundStatus.DONE;
    refund.completedAt = now;
    refund.failureReason = null;
  }

  /** PG가 환불을 거절했다. 운영자가 다시 시도할 수 있다. */
  failRefund(refundId: string, reason: string): void {
    const refund = this.refund(refundId);
    if (refund.status === RefundStatus.DONE) return;
    refund.status = RefundStatus.FAILED;
    refund.failureReason = reason.slice(0, 300);
  }

  /** 메뉴 요약 (후라이드 치킨 외 2개) */
  summary(): string {
    const [first, ...rest] = this.state.lines;
    return rest.length ? `${first.name} 외 ${rest.length}개` : first.name;
  }

  isOrderedBy(userId: string): boolean {
    return this.state.consumerUserId === userId;
  }

  /** 결제를 확인했다. 금액이 다르면 받지 않는다 (PG 결제 금액을 서버가 정한 금액과 견준다). */
  markPaid(paidAmount: number, now: Date): void {
    this.assertStatus(
      [FoodOrderStatus.PENDING_PAYMENT],
      'FOOD_ORDER_NOT_PENDING_PAYMENT',
    );
    if (paidAmount !== this.state.paymentAmount) {
      throw new ConflictError(
        'PAYMENT_AMOUNT_MISMATCH',
        '결제 금액이 주문 금액과 달라요.',
      );
    }
    this.state.status = FoodOrderStatus.PLACED;
    this.state.paidAt = now;
    this.raise(
      new FoodOrderPlacedEvent(
        this.id,
        now,
        this.state.storeOwnerUserId,
        this.summary(),
        this.state.paymentAmount,
      ),
    );
  }

  /** 가게가 받는다. 조리 시간을 정하고, 유스케이스가 요청한 배달을 잇는다. */
  accept(cookMinutes: number, deliveryOrderId: string, now: Date): void {
    this.assertStatus([FoodOrderStatus.PLACED], 'FOOD_ORDER_NOT_PLACED');
    assertCookMinutes(cookMinutes);
    this.state.status = FoodOrderStatus.ACCEPTED;
    this.state.cookMinutes = cookMinutes;
    this.state.acceptedAt = now;
    this.state.deliveryOrderId = deliveryOrderId;
    this.raise(
      new FoodOrderAcceptedEvent(
        this.id,
        now,
        this.state.consumerUserId,
        this.state.storeName,
        cookMinutes,
      ),
    );
  }

  /** 가게가 받지 않는다 (사유 필수). 결제한 금액을 모두 돌려준다. */
  reject(reason: string, refundId: string, now: Date): void {
    this.assertStatus([FoodOrderStatus.PLACED], 'FOOD_ORDER_NOT_PLACED');
    const trimmed = reason.trim();
    if (!trimmed) {
      throw new InvalidArgumentError(
        'REJECT_REASON_REQUIRED',
        '거절 사유를 골라 주세요.',
      );
    }
    this.state.status = FoodOrderStatus.REJECTED;
    this.state.rejectedAt = now;
    this.state.rejectReason = trimmed;
    this.refundRest(refundId, `가게 거절: ${trimmed}`, now);
    this.raise(
      new FoodOrderRejectedEvent(
        this.id,
        now,
        this.state.consumerUserId,
        this.state.storeName,
        trimmed,
      ),
    );
  }

  /**
   * 취소한다. 결제했으면 모두 돌려준다.
   * - 손님: 가게가 받기 전까지 (결제 전 포함)
   * - 가게: 받은 뒤 라이더가 픽업하기 전까지 (받기 전에는 거절한다)
   * - 운영자: 픽업 전까지
   */
  cancel(
    by: FoodOrderCanceller,
    reason: string,
    refundId: string,
    now: Date,
  ): void {
    const allowed: Record<FoodOrderCanceller, FoodOrderStatus[]> = {
      [FoodOrderCanceller.CONSUMER]: [
        FoodOrderStatus.PENDING_PAYMENT,
        FoodOrderStatus.PLACED,
      ],
      [FoodOrderCanceller.STORE]: [FoodOrderStatus.ACCEPTED],
      [FoodOrderCanceller.ADMIN]: [
        FoodOrderStatus.PENDING_PAYMENT,
        FoodOrderStatus.PLACED,
        FoodOrderStatus.ACCEPTED,
      ],
    };
    if (!allowed[by].includes(this.state.status)) {
      throw new ConflictError(
        'FOOD_ORDER_NOT_CANCELLABLE',
        by === FoodOrderCanceller.CONSUMER
          ? '가게가 주문을 받은 뒤에는 취소할 수 없어요. 가게에 전화해 주세요.'
          : '지금은 주문을 취소할 수 없어요.',
      );
    }
    const wasPaid = this.isPaid;
    this.state.status = FoodOrderStatus.CANCELLED;
    this.state.cancelledAt = now;
    this.state.cancelReason = reason.trim() || null;
    this.state.cancelledBy = by;
    if (wasPaid) {
      this.refundRest(
        refundId,
        `주문 취소${reason.trim() ? `: ${reason.trim()}` : ''}`,
        now,
      );
    }
    this.raise(
      new FoodOrderCancelledEvent(
        this.id,
        now,
        this.state.consumerUserId,
        this.state.storeOwnerUserId,
        this.state.storeName,
        by,
        wasPaid,
      ),
    );
  }

  /** 라이더가 픽업했다 (배달 컨텍스트의 이벤트로 안다). 이미 반영했으면 그대로 둔다. */
  markPickedUp(now: Date): void {
    if (this.state.status !== FoodOrderStatus.ACCEPTED) return;
    this.state.status = FoodOrderStatus.PICKED_UP;
    this.state.pickedUpAt = now;
    this.raise(
      new FoodOrderPickedUpEvent(
        this.id,
        now,
        this.state.consumerUserId,
        this.state.storeName,
      ),
    );
  }

  /** 배달이 끝났다. 이미 반영했으면 false. */
  markDelivered(now: Date): boolean {
    if (
      this.state.status !== FoodOrderStatus.ACCEPTED &&
      this.state.status !== FoodOrderStatus.PICKED_UP
    ) {
      return false;
    }
    this.state.pickedUpAt ??= now;
    this.state.status = FoodOrderStatus.DELIVERED;
    this.state.deliveredAt = now;
    this.raise(
      new FoodOrderDeliveredEvent(
        this.id,
        now,
        this.state.consumerUserId,
        this.state.storeName,
      ),
    );
    return true;
  }

  /** 배달이 끝난 주문의 일부를 운영자가 돌려준다. */
  refundPartially(input: {
    id: string;
    amount: number;
    reason: string;
    borneBy: RefundBearer;
    adminId: string;
    now: Date;
  }): FoodOrderRefund {
    this.assertStatus([FoodOrderStatus.DELIVERED], 'FOOD_ORDER_NOT_DELIVERED');
    if (!Number.isInteger(input.amount) || input.amount <= 0) {
      throw new InvalidArgumentError(
        'INVALID_REFUND_AMOUNT',
        '돌려줄 금액을 적어 주세요.',
      );
    }
    if (input.amount > this.refundableAmount) {
      throw new ConflictError(
        'REFUND_EXCEEDS_PAID',
        `돌려줄 수 있는 금액은 ${this.refundableAmount.toLocaleString('ko-KR')}원까지예요.`,
      );
    }
    const reason = input.reason.trim();
    if (!reason) {
      throw new InvalidArgumentError(
        'REFUND_REASON_REQUIRED',
        '환불 사유를 적어 주세요.',
      );
    }
    const refund: FoodOrderRefund = {
      id: input.id,
      amount: input.amount,
      reason,
      borneBy: input.borneBy,
      refundedBy: input.adminId,
      refundedAt: input.now,
      status: RefundStatus.PENDING,
      completedAt: null,
      failureReason: null,
    };
    this.state.refunds.push(refund);
    return refund;
  }

  /** 리뷰를 쓸 수 있는지: 내가 시켰고, 배달이 끝났고, 기간 안이다. */
  assertReviewable(userId: string, windowDays: number, now: Date): void {
    if (!this.isOrderedBy(userId)) {
      throw new ForbiddenError(
        'NOT_FOOD_ORDER_OWNER',
        '내 주문에만 리뷰를 쓸 수 있어요.',
      );
    }
    if (
      this.state.status !== FoodOrderStatus.DELIVERED ||
      !this.state.deliveredAt
    ) {
      throw new ConflictError(
        'FOOD_ORDER_NOT_DELIVERED',
        '배달이 끝난 주문에 리뷰를 쓸 수 있어요.',
      );
    }
    if (
      now.getTime() - this.state.deliveredAt.getTime() >
      windowDays * 24 * 60 * 60_000
    ) {
      throw new ConflictError(
        'REVIEW_WINDOW_CLOSED',
        `리뷰는 배달이 끝나고 ${windowDays}일 안에 쓸 수 있어요.`,
      );
    }
  }

  private refundRest(id: string, reason: string, now: Date): void {
    const amount = this.refundableAmount;
    if (amount <= 0) return;
    this.state.refunds.push({
      id,
      amount,
      reason,
      borneBy: null,
      refundedBy: null,
      refundedAt: now,
      status: RefundStatus.PENDING,
      completedAt: null,
      failureReason: null,
    });
  }

  private refund(refundId: string): FoodOrderRefund {
    const refund = this.state.refunds.find((each) => each.id === refundId);
    if (!refund) {
      throw new InvalidArgumentError(
        'REFUND_NOT_FOUND',
        '환불 내역을 찾을 수 없어요.',
      );
    }
    return refund;
  }

  private assertStatus(allowed: FoodOrderStatus[], code: string): void {
    if (!allowed.includes(this.state.status)) {
      throw new ConflictError(code, '지금 상태에서는 할 수 없어요.');
    }
  }
}

function request(value: string | null, label: string): string | null {
  const trimmed = value?.trim() || null;
  if (trimmed && trimmed.length > MAX_REQUEST_LENGTH) {
    throw new InvalidArgumentError(
      'REQUEST_TOO_LONG',
      `${label}은 ${MAX_REQUEST_LENGTH}자까지 쓸 수 있어요.`,
    );
  }
  return trimmed;
}

function assertCookMinutes(minutes: number): void {
  if (!Number.isInteger(minutes) || minutes < 0 || minutes > MAX_COOK_MINUTES) {
    throw new InvalidArgumentError(
      'INVALID_COOK_MINUTES',
      `조리 시간은 0분부터 ${MAX_COOK_MINUTES}분까지 정해 주세요.`,
    );
  }
}
