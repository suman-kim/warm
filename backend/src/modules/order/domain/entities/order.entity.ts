import { AggregateRoot } from '../../../../common/domain/aggregate-root.js';
import { DISPATCH_RADIUS_KM } from '../../../../common/domain/dispatch-area.js';
import {
  ConflictError,
  ForbiddenError,
  InvalidArgumentError,
} from '../../../../common/domain/domain-error.js';
import { kstDateString } from '../../../../common/domain/kst.js';
import {
  OrderArrivedEvent,
  OrderAssignedEvent,
  OrderCancelledEvent,
  OrderDeliveredEvent,
  OrderDepartedEvent,
  OrderPickedUpEvent,
  OrderRequestedEvent,
} from '../events/order.events.js';
import {
  AWAITING_PICKUP_STATUSES,
  IN_PROGRESS_STATUSES,
  OrderStatus,
} from '../order-status.js';
import { Money } from '../value-objects/money.js';
import {
  CollectedMethod,
  DeliveryFeePolicy,
  DeliverySource,
  DoorPayment,
  newStoreDelivery,
  StoreDelivery,
} from '../value-objects/store-delivery.js';
import { Waypoint } from '../value-objects/waypoint.js';

export interface OrderState {
  id: string;
  /** 요청한 사장님의 회원 ID */
  customerId: string;
  /** 어느 가게의 배달인지, 음식값과 받는 방식, 조리 완료 시각, 받은 돈 */
  storeDelivery: StoreDelivery;
  /** 가게 (픽업지) */
  pickup: Waypoint;
  /** 손님 (도착지) */
  dropoff: Waypoint;
  memo: string | null;
  /** 가게에서 손님까지의 운행 거리(km) */
  distanceKm: number;
  /** 가게에서 손님까지의 예상 소요 시간(분) */
  durationMinutes: number;
  /** 배달대행료 — 요청할 때 가게 충전금에서 빠졌다 */
  fare: Money;
  status: OrderStatus;
  /** 배차된 라이더 ID. 배차 전에는 null. */
  driverId: string | null;
  /** 배차될 때 어림한 픽업 예정 시각. 라이더 위치를 모르면 null. */
  estimatedPickupAt: Date | null;
  requestedAt: Date;
  assignedAt: Date | null;
  departedAt: Date | null;
  arrivedAt: Date | null;
  pickedUpAt: Date | null;
  deliveredAt: Date | null;
  cancelledAt: Date | null;
  cancelReason: string | null;
  /** 취소 수수료. 없으면 0. */
  cancellationFee: Money;
}

export interface RequestDeliveryInput {
  id: string;
  ownerUserId: string;
  storeId: string;
  /** 어디서 온 배달인지. 빼면 가게가 직접 요청한 것. */
  source?: DeliverySource;
  sourceOrderId?: string | null;
  pickup: Waypoint;
  dropoff: Waypoint;
  memo?: string | null;
  distanceKm: number;
  durationMinutes: number;
  deliveryFee: Money;
  foodAmount: number;
  doorPayment: DoorPayment;
  readyAt: Date | null;
  now: Date;
}

const MAX_MEMO_LENGTH = 500;
const MINUTE_MS = 60_000;

/**
 * 배달(주문) 애그리거트.
 * 가게의 요청에서 시작해 배차 → (출발) → 가게 도착 → 픽업 → 배달 완료로 흐르는 상태 전이와,
 * 취소 수수료·만나서 결제로 받은 돈을 지킨다.
 */
export class Order extends AggregateRoot {
  private constructor(
    private readonly state: OrderState,
    version: number,
  ) {
    super(state.id, version);
  }

  /**
   * 가게가 배달을 요청한다. 픽업지는 가게, 요금은 배달대행료다.
   * 대행료는 유스케이스가 가게 충전금에서 먼저 뺐다.
   */
  static request(input: RequestDeliveryInput): Order {
    const memo = input.memo?.trim() || null;
    if (memo && memo.length > MAX_MEMO_LENGTH) {
      throw new InvalidArgumentError(
        'MEMO_TOO_LONG',
        `요청 사항은 ${MAX_MEMO_LENGTH}자까지 쓸 수 있어요.`,
      );
    }
    const order = new Order(
      {
        id: input.id,
        customerId: input.ownerUserId,
        storeDelivery: newStoreDelivery({
          storeId: input.storeId,
          source: input.source,
          sourceOrderId: input.sourceOrderId,
          foodAmount: input.foodAmount,
          doorPayment: input.doorPayment,
          readyAt: input.readyAt,
          now: input.now,
        }),
        pickup: input.pickup,
        dropoff: input.dropoff,
        memo,
        distanceKm: input.distanceKm,
        durationMinutes: input.durationMinutes,
        fare: input.deliveryFee,
        status: OrderStatus.REQUESTED,
        driverId: null,
        estimatedPickupAt: null,
        requestedAt: input.now,
        assignedAt: null,
        departedAt: null,
        arrivedAt: null,
        pickedUpAt: null,
        deliveredAt: null,
        cancelledAt: null,
        cancelReason: null,
        cancellationFee: Money.won(0),
      },
      0,
    );
    order.raise(
      new OrderRequestedEvent(
        order.id,
        input.now,
        input.ownerUserId,
        input.pickup.area,
        input.dropoff.area,
        input.deliveryFee.amount,
        {
          latitude: input.pickup.point.latitude,
          longitude: input.pickup.point.longitude,
        },
        DISPATCH_RADIUS_KM,
      ),
    );
    return order;
  }

  /** 저장된 상태에서 되살린다 (저장소 전용). */
  static restore(state: OrderState, version: number): Order {
    return new Order(state, version);
  }

  get customerId(): string {
    return this.state.customerId;
  }

  /** 사람이 부르는 주문번호 — MV261015-3F9A (요청한 날 + 주문 ID 앞 네 자리). 끝 네 자리를 가게에 말한다. */
  get code(): string {
    return Order.codeOf(this.state.id, this.state.requestedAt);
  }

  static codeOf(id: string, requestedAt: Date): string {
    const day = kstDateString(requestedAt).slice(2).replaceAll('-', '');
    return `MV${day}-${id.slice(0, 4).toUpperCase()}`;
  }

  /** 알림에 적을 구간 (예: 역삼동 → 대치동). 동이 없으면 시·군·구. */
  get routeLabel(): string {
    const area = (waypoint: Waypoint) =>
      waypoint.dong ??
      waypoint.sigungu ??
      waypoint.address.split(/\s+/)[1] ??
      '';
    return `${area(this.state.pickup)} → ${area(this.state.dropoff)}`;
  }

  get driverId(): string | null {
    return this.state.driverId;
  }

  get status(): OrderStatus {
    return this.state.status;
  }

  /** 배달대행료 */
  get fare(): number {
    return this.state.fare.amount;
  }

  get storeDelivery(): Readonly<StoreDelivery> {
    return { ...this.state.storeDelivery };
  }

  isOwnedBy(customerId: string): boolean {
    return this.state.customerId === customerId;
  }

  isAssignedTo(driverId: string): boolean {
    return this.state.driverId === driverId;
  }

  /** 라이더가 맡아 진행 중인지 (배차 완료 ~ 배달 완료 전). */
  isInProgress(): boolean {
    return IN_PROGRESS_STATUSES.includes(this.state.status);
  }

  /** 라이더가 픽업하러 가는 중인지 (배차 완료 ~ 픽업 전). */
  isAwaitingPickup(): boolean {
    return AWAITING_PICKUP_STATUSES.includes(this.state.status);
  }

  /** 취소한 배달에서 충전금으로 돌려줄 금액 = 대행료 − 취소 수수료. 취소하지 않았으면 0. */
  refundDueOnCancel(): number {
    if (this.state.status !== OrderStatus.CANCELLED) return 0;
    return this.state.fare.amount - this.state.cancellationFee.amount;
  }

  /**
   * 지금 취소하면 내는 수수료. 취소할 수 없는 상태(픽업 뒤)면 null.
   * 라이더가 출발·도착하기 전에는 0원, 그 뒤에는 대행료의 15%다.
   */
  cancellationFeeNow(): number | null {
    switch (this.state.status) {
      case OrderStatus.REQUESTED:
      case OrderStatus.ASSIGNED:
        return 0;
      case OrderStatus.DEPARTED:
      case OrderStatus.ARRIVED:
        return DeliveryFeePolicy.cancellationFee(this.state.fare.amount);
      default:
        return null;
    }
  }

  /**
   * 도착 예정 시각. 픽업했으면 픽업 시각에서, 아니면 픽업 예정 시각에서
   * 예상 소요 시간을 더한다. 어림할 근거가 없으면 null.
   */
  get estimatedDeliveryAt(): Date | null {
    if (this.state.deliveredAt || this.state.cancelledAt) return null;
    const departure = this.state.pickedUpAt ?? this.state.estimatedPickupAt;
    return departure
      ? new Date(departure.getTime() + this.state.durationMinutes * MINUTE_MS)
      : null;
  }

  /**
   * 라이더가 수락해 배차한다. 먼저 수락한 라이더가 잡는다.
   * [estimatedPickupAt]은 라이더 위치에서 어림한 픽업 예정 시각이다.
   */
  assign(
    driverId: string,
    now: Date,
    estimatedPickupAt: Date | null = null,
  ): void {
    if (this.state.status !== OrderStatus.REQUESTED) {
      throw new ConflictError(
        'ORDER_NOT_OPEN',
        '이미 배차됐거나 취소된 배달이에요.',
      );
    }
    this.state.status = OrderStatus.ASSIGNED;
    this.state.driverId = driverId;
    this.state.assignedAt = now;
    this.state.estimatedPickupAt = estimatedPickupAt;
    this.raise(
      new OrderAssignedEvent(this.id, now, this.state.customerId, driverId),
    );
  }

  /** 라이더가 가게로 출발한다. 이때부터 취소 수수료가 붙는다. */
  depart(driverId: string, now: Date): void {
    this.assertAssignedDriver(driverId);
    this.assertStatus([OrderStatus.ASSIGNED], 'ORDER_NOT_AWAITING_DEPARTURE');
    this.state.status = OrderStatus.DEPARTED;
    this.state.departedAt = now;
    this.raise(
      new OrderDepartedEvent(this.id, now, this.state.customerId, driverId),
    );
  }

  /** 라이더가 가게에 도착한다. 출발을 누르지 않았으면 지금 출발한 것으로 본다. */
  arrive(driverId: string, now: Date): void {
    this.assertAssignedDriver(driverId);
    this.assertStatus(
      [OrderStatus.ASSIGNED, OrderStatus.DEPARTED],
      'ORDER_NOT_ON_THE_WAY',
    );
    this.state.status = OrderStatus.ARRIVED;
    this.state.departedAt ??= now;
    this.state.arrivedAt = now;
    this.raise(
      new OrderArrivedEvent(this.id, now, this.state.customerId, driverId),
    );
  }

  /** 라이더가 음식을 픽업한다. 도착을 누르지 않았으면 지금 도착한 것으로 본다. */
  pickUp(driverId: string, now: Date): void {
    this.assertAssignedDriver(driverId);
    if (!this.isAwaitingPickup()) {
      throw new ConflictError(
        'ORDER_NOT_AWAITING_PICKUP',
        '픽업할 수 있는 상태가 아니에요.',
      );
    }
    this.state.departedAt ??= now;
    this.state.arrivedAt ??= now;
    this.state.status = OrderStatus.PICKED_UP;
    this.state.pickedUpAt = now;
    this.raise(
      new OrderPickedUpEvent(this.id, now, this.state.customerId, driverId),
    );
  }

  /**
   * 라이더가 배달을 마친다. 만나서 결제하는 배달이면 받은 방식(현금·카드)과 금액을 함께 남긴다.
   */
  deliver(
    driverId: string,
    now: Date,
    collection: { method: CollectedMethod; amount: number } | null = null,
  ): void {
    this.assertAssignedDriver(driverId);
    if (this.state.status !== OrderStatus.PICKED_UP) {
      throw new ConflictError(
        'ORDER_NOT_IN_TRANSIT',
        '픽업한 뒤에 배달을 마칠 수 있어요.',
      );
    }
    const delivery = this.state.storeDelivery;
    if (delivery.doorPayment !== DoorPayment.PREPAID) {
      if (
        !collection ||
        !Number.isInteger(collection.amount) ||
        collection.amount < 0
      ) {
        throw new InvalidArgumentError(
          'COLLECTION_REQUIRED',
          '손님에게 받은 방식과 금액을 넣어 주세요.',
        );
      }
      this.state.storeDelivery = {
        ...delivery,
        collectedMethod: collection.method,
        collectedAmount: collection.amount,
      };
    }
    this.state.status = OrderStatus.DELIVERED;
    this.state.deliveredAt = now;
    this.raise(
      new OrderDeliveredEvent(this.id, now, this.state.customerId, driverId),
    );
  }

  /**
   * 라이더가 받은 현금을 가게에 넘겼는지 표시한다 (운영자가 확인한다).
   * 만나서 현금으로 끝난 배달만 된다. 이미 넘긴 것을 다시 넘김으로 표시하면 처음 시각을 지킨다.
   */
  markCashHanded(handed: boolean, now: Date): void {
    const delivery = this.state.storeDelivery;
    if (
      this.state.status !== OrderStatus.DELIVERED ||
      delivery.collectedMethod !== DoorPayment.CASH
    ) {
      throw new ConflictError(
        'NO_CASH_COLLECTED',
        '현금을 받은 배달이 아니에요.',
      );
    }
    this.state.storeDelivery = {
      ...delivery,
      cashHandedAt: handed ? (delivery.cashHandedAt ?? now) : null,
    };
  }

  /**
   * 가게가 배달을 취소한다. 픽업하기 전까지만 할 수 있다.
   * 라이더가 출발·도착하기 전에는 수수료가 없고, 그 뒤에는 대행료의 15%를 수수료로 뗀다.
   */
  cancelByCustomer(customerId: string, reason: string, now: Date): void {
    this.assertOwner(customerId);
    const fee = this.cancellationFeeNow();
    if (fee === null) {
      throw new ConflictError(
        'ORDER_NOT_CANCELLABLE',
        '픽업 이후에는 취소할 수 없어요.',
      );
    }
    this.state.status = OrderStatus.CANCELLED;
    this.state.cancelledAt = now;
    this.state.cancelReason = reason.trim() || null;
    this.state.cancellationFee = Money.won(fee);
    this.raise(
      new OrderCancelledEvent(
        this.id,
        now,
        this.state.customerId,
        this.state.driverId,
        fee,
        this.state.fare.amount - fee,
      ),
    );
  }

  snapshot(): Readonly<OrderState> {
    return { ...this.state };
  }

  private assertOwner(customerId: string): void {
    if (!this.isOwnedBy(customerId)) {
      throw new ForbiddenError('NOT_ORDER_OWNER', '내 배달만 바꿀 수 있어요.');
    }
  }

  private assertAssignedDriver(driverId: string): void {
    if (!this.isAssignedTo(driverId)) {
      throw new ForbiddenError(
        'NOT_ASSIGNED_DRIVER',
        '배차받은 배달만 처리할 수 있어요.',
      );
    }
  }

  private assertStatus(allowed: OrderStatus[], code: string): void {
    if (!allowed.includes(this.state.status)) {
      throw new ConflictError(code, '지금 상태에서는 할 수 없어요.');
    }
  }
}
