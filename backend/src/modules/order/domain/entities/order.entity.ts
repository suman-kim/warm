import { AggregateRoot } from '../../../../common/domain/aggregate-root.js';
import { DISPATCH_RADIUS_KM } from '../../../../common/domain/dispatch-area.js';
import {
  ConflictError,
  ForbiddenError,
  InvalidArgumentError,
} from '../../../../common/domain/domain-error.js';
import {
  ServiceType,
  VEHICLE_SPECS,
  VehicleType,
} from '../../../../common/domain/vehicle-type.js';
import {
  OrderArrivedEvent,
  OrderAssignedEvent,
  OrderCancelledEvent,
  OrderDeliveredEvent,
  OrderDepartedEvent,
  OrderNoShowEvent,
  OrderPaymentFailedEvent,
  OrderPickedUpEvent,
  OrderRequestedEvent,
} from '../events/order.events.js';
import {
  AWAITING_PICKUP_STATUSES,
  IN_PROGRESS_STATUSES,
  OrderStatus,
} from '../order-status.js';
import {
  ChargePolicy,
  ExtraItems,
  FloorAccess,
  GROUND_FLOOR,
  LoadingHelp,
  NO_EXTRA_ITEMS,
} from '../services/charge-policy.js';
import { kstDateString } from '../../../../common/domain/kst.js';
import { Cargo } from '../value-objects/cargo.js';
import { Money } from '../value-objects/money.js';
import { Waypoint } from '../value-objects/waypoint.js';

export interface OrderState {
  id: string;
  /** 요청한 고객의 회원 ID */
  customerId: string;
  serviceType: ServiceType;
  vehicleType: VehicleType;
  pickup: Waypoint;
  dropoff: Waypoint;
  cargo: Cargo;
  memo: string | null;
  /** 픽업지에서 도착지까지의 운행 거리(km) */
  distanceKm: number;
  /** 픽업지에서 도착지까지의 예상 소요 시간(분) */
  durationMinutes: number;
  /** 기본 요금 — 차종과 거리로 정한다 */
  baseFare: Money;
  loadingHelp: LoadingHelp;
  helpFee: Money;
  pickupAccess: FloorAccess;
  dropoffAccess: FloorAccess;
  /** 엘리베이터 없는 층의 계단 요금 (고객이 요청할 때 넣은 층으로 정한다) */
  stairFee: Money;
  /** 배차될 때 결제하는 요금 = 기본 요금 + 운반 도움 + 계단 */
  fare: Money;
  /** 결제할 카드 (결제 수단 ID) */
  paymentMethodId: string | null;
  status: OrderStatus;
  /** 배차된(또는 결제 중인) 기사 ID. 배차 전에는 null. */
  driverId: string | null;
  /** 예약 픽업 시각. null이면 바로 픽업. */
  scheduledPickupAt: Date | null;
  /** 배차될 때 어림한 픽업 예정 시각. 기사 위치를 모르면 null. */
  estimatedPickupAt: Date | null;
  requestedAt: Date;
  assignedAt: Date | null;
  departedAt: Date | null;
  arrivedAt: Date | null;
  pickedUpAt: Date | null;
  deliveredAt: Date | null;
  cancelledAt: Date | null;
  noShowAt: Date | null;
  cancelReason: string | null;
  /** 기사가 픽업지에서 넣은 추가 요금의 수량과 금액 */
  extraItems: ExtraItems;
  extraFee: Money;
  /** 기사가 도착한 뒤 픽업할 때까지 기다린 시간과 대기료 */
  waitingMinutes: number;
  waitingFee: Money;
  /** 취소 수수료 또는 노쇼로 받는 금액. 없으면 0. */
  cancellationFee: Money;
  /** 배차 때 결제가 안 된 사유 (PaymentFailureCode) */
  paymentFailureCode: string | null;
}

export interface RequestOrderInput {
  id: string;
  customerId: string;
  vehicleType: VehicleType;
  pickup: Waypoint;
  dropoff: Waypoint;
  cargo: Cargo;
  memo?: string | null;
  distanceKm: number;
  durationMinutes: number;
  baseFare: Money;
  loadingHelp?: LoadingHelp;
  pickupAccess?: FloorAccess;
  dropoffAccess?: FloorAccess;
  paymentMethodId: string | null;
  scheduledPickupAt?: Date | null;
  now: Date;
}

/** 주문을 수락하려는 기사. */
export interface AssignableDriver {
  id: string;
  vehicleType: VehicleType;
}

const MAX_MEMO_LENGTH = 500;
const MINUTE_MS = 60_000;
/**
 * 주문(배송 요청) 애그리거트.
 * 고객의 요청에서 시작해 결제·배차 → 출발 → 도착 → 픽업 → 배송 완료로 흐르는 상태 전이와,
 * 그 사이에 붙는 요금(운반 도움·계단·추가 요금·대기료·취소 수수료)을 지킨다.
 */
export class Order extends AggregateRoot {
  private constructor(
    private readonly state: OrderState,
    version: number,
  ) {
    super(state.id, version);
  }

  /** 고객이 배송을 요청한다. 배차 대기 상태로 시작한다. 결제는 배차될 때 한다. */
  static request(input: RequestOrderInput): Order {
    const spec = VEHICLE_SPECS[input.vehicleType];
    if (input.cargo.weightKg > spec.maxLoadKg) {
      throw new InvalidArgumentError(
        'CARGO_TOO_HEAVY',
        `${spec.label}에는 ${spec.maxLoadKg}kg까지 실을 수 있어요.`,
      );
    }
    const scheduledPickupAt = input.scheduledPickupAt ?? null;
    if (scheduledPickupAt && scheduledPickupAt <= input.now) {
      throw new InvalidArgumentError(
        'SCHEDULE_IN_PAST',
        '예약 픽업 시각은 지금보다 뒤여야 해요.',
      );
    }
    const memo = input.memo?.trim() || null;
    if (memo && memo.length > MAX_MEMO_LENGTH) {
      throw new InvalidArgumentError(
        'MEMO_TOO_LONG',
        `요청 사항은 ${MAX_MEMO_LENGTH}자까지 쓸 수 있어요.`,
      );
    }
    const loadingHelp = input.loadingHelp ?? LoadingHelp.NONE;
    const pickupAccess = input.pickupAccess ?? { ...GROUND_FLOOR };
    const dropoffAccess = input.dropoffAccess ?? { ...GROUND_FLOOR };
    ChargePolicy.assertFloorAccess(pickupAccess);
    ChargePolicy.assertFloorAccess(dropoffAccess);
    const helpFee = Money.won(ChargePolicy.helpFee(loadingHelp));
    const stairFee = Money.won(
      ChargePolicy.stairFee(pickupAccess, dropoffAccess),
    );
    const fare = Money.won(
      input.baseFare.amount + helpFee.amount + stairFee.amount,
    );
    const order = new Order(
      {
        id: input.id,
        customerId: input.customerId,
        serviceType: spec.serviceType,
        vehicleType: input.vehicleType,
        pickup: input.pickup,
        dropoff: input.dropoff,
        cargo: input.cargo,
        memo,
        distanceKm: input.distanceKm,
        durationMinutes: input.durationMinutes,
        baseFare: input.baseFare,
        loadingHelp,
        helpFee,
        pickupAccess,
        dropoffAccess,
        stairFee,
        fare,
        paymentMethodId: input.paymentMethodId,
        status: OrderStatus.REQUESTED,
        driverId: null,
        scheduledPickupAt,
        estimatedPickupAt: null,
        requestedAt: input.now,
        assignedAt: null,
        departedAt: null,
        arrivedAt: null,
        pickedUpAt: null,
        deliveredAt: null,
        cancelledAt: null,
        noShowAt: null,
        cancelReason: null,
        extraItems: { ...NO_EXTRA_ITEMS },
        extraFee: Money.won(0),
        waitingMinutes: 0,
        waitingFee: Money.won(0),
        cancellationFee: Money.won(0),
        paymentFailureCode: null,
      },
      0,
    );
    order.raiseRequested(input.now);
    return order;
  }

  /** 저장된 상태에서 되살린다 (저장소 전용). */
  static restore(state: OrderState, version: number): Order {
    return new Order(state, version);
  }

  get customerId(): string {
    return this.state.customerId;
  }

  /** 사람이 부르는 주문번호 — MV261013-3F9A (요청한 날 + 주문 ID 앞 네 자리). 영수증과 관리자 웹이 같은 값을 쓴다. */
  get code(): string {
    return Order.codeOf(this.state.id, this.state.requestedAt);
  }

  static codeOf(id: string, requestedAt: Date): string {
    const day = kstDateString(requestedAt).slice(2).replaceAll('-', '');
    return `MV${day}-${id.slice(0, 4).toUpperCase()}`;
  }

  /** 카드 명세서·PG사 결제창에 보일 이름 (예: MOVO 퀵 성수동→역삼동) */
  get chargeName(): string {
    const kind = this.state.serviceType === ServiceType.QUICK ? '퀵' : '화물';
    return `MOVO ${kind} ${this.routeLabel.replace(' → ', '→')}`;
  }

  /** 알림에 적을 구간 (예: 성수동 → 역삼동). 동이 없으면 시·군·구. */
  get routeLabel(): string {
    const area = (waypoint: Waypoint) =>
      waypoint.dong ??
      waypoint.sigungu ??
      waypoint.address.split(/\s+/)[1] ??
      '';
    return `${area(this.state.pickup)} → ${area(this.state.dropoff)}`;
  }

  get paymentMethodId(): string | null {
    return this.state.paymentMethodId;
  }

  get driverId(): string | null {
    return this.state.driverId;
  }

  get status(): OrderStatus {
    return this.state.status;
  }

  /** 배차될 때 결제하는 요금 */
  get fare(): number {
    return this.state.fare.amount;
  }

  /** 최종 요금 = 배차 때 결제한 요금 + 추가 요금 + 대기료 */
  get totalFare(): number {
    return (
      this.state.fare.amount +
      this.state.extraFee.amount +
      this.state.waitingFee.amount
    );
  }

  isOwnedBy(customerId: string): boolean {
    return this.state.customerId === customerId;
  }

  isAssignedTo(driverId: string): boolean {
    return this.state.driverId === driverId;
  }

  /** 기사가 배정돼 배송이 진행 중인지 (배차 완료 ~ 배송 완료 전). */
  isInProgress(): boolean {
    return IN_PROGRESS_STATUSES.includes(this.state.status);
  }

  /** 기사가 픽업하러 가는 중인지 (배차 완료 ~ 픽업 전). */
  isAwaitingPickup(): boolean {
    return AWAITING_PICKUP_STATUSES.includes(this.state.status);
  }

  /** 배차 때 결제한 주문인지 (결제가 끝났고 아직 돌려주지 않았는지와는 무관). */
  wasCharged(): boolean {
    return this.state.assignedAt !== null;
  }

  /** 고객이 취소한 주문에서 돌려줄 금액 = 배차 때 결제한 요금 − 취소 수수료. 결제 전에 취소했으면 0. */
  refundDueOnCancel(): number {
    if (this.state.status !== OrderStatus.CANCELLED || !this.wasCharged()) {
      return 0;
    }
    return this.state.fare.amount - this.state.cancellationFee.amount;
  }

  /**
   * 지금 취소하면 받는 수수료. 취소할 수 없는 상태면 null.
   * 배차 전과 기사가 출발하기 전에는 0원, 출발한 뒤에는 요금의 일정 비율이다.
   */
  cancellationFeeNow(): number | null {
    switch (this.state.status) {
      case OrderStatus.REQUESTED:
      case OrderStatus.PAYMENT_FAILED:
      case OrderStatus.ASSIGNED:
        return 0;
      case OrderStatus.DEPARTED:
      case OrderStatus.ARRIVED:
        return ChargePolicy.cancellationFee(this.state.fare.amount);
      default:
        return null;
    }
  }

  /**
   * 도착 예정 시각. 픽업했으면 픽업 시각에서, 아니면 픽업 예정 시각에서
   * 예상 소요 시간을 더한다. 어림할 근거가 없으면 null.
   */
  get estimatedDeliveryAt(): Date | null {
    if (
      this.state.deliveredAt ||
      this.state.cancelledAt ||
      this.state.noShowAt
    ) {
      return null;
    }
    const departure = this.state.pickedUpAt ?? this.state.estimatedPickupAt;
    return departure
      ? new Date(departure.getTime() + this.state.durationMinutes * MINUTE_MS)
      : null;
  }

  /**
   * 기사가 수락했다 — 결제하는 동안 다른 기사가 수락하지 못하게 잡아 둔다.
   * 요청한 차종의 기사만 수락할 수 있다. 결제가 끝나면 confirmAssignment, 안 되면 failPayment.
   */
  reserveForPayment(driver: AssignableDriver): void {
    if (this.state.status !== OrderStatus.REQUESTED) {
      throw new ConflictError(
        'ORDER_NOT_OPEN',
        '이미 배차됐거나 취소된 주문이에요.',
      );
    }
    if (driver.vehicleType !== this.state.vehicleType) {
      throw new ConflictError(
        'VEHICLE_TYPE_MISMATCH',
        '요청한 차종과 맞지 않아 수락할 수 없어요.',
      );
    }
    this.state.status = OrderStatus.PAYING;
    this.state.driverId = driver.id;
  }

  /** 결제가 끝나 배차를 마친다. [estimatedPickupAt]은 기사 위치에서 어림한 픽업 예정 시각이다. */
  confirmAssignment(now: Date, estimatedPickupAt: Date | null = null): void {
    this.assertStatus([OrderStatus.PAYING], 'ORDER_NOT_PAYING');
    this.state.status = OrderStatus.ASSIGNED;
    this.state.assignedAt = now;
    this.state.estimatedPickupAt = estimatedPickupAt;
    this.state.paymentFailureCode = null;
    this.raise(
      new OrderAssignedEvent(
        this.id,
        now,
        this.state.customerId,
        this.state.driverId!,
      ),
    );
  }

  /** 결제가 안 됐다. 배차하지 않고, 고객이 다른 카드로 다시 요청할 때까지 대기 목록에서 내린다. */
  failPayment(failureCode: string, now: Date): void {
    this.assertStatus([OrderStatus.PAYING], 'ORDER_NOT_PAYING');
    this.state.status = OrderStatus.PAYMENT_FAILED;
    this.state.driverId = null;
    this.state.paymentFailureCode = failureCode;
    this.raise(
      new OrderPaymentFailedEvent(
        this.id,
        now,
        this.state.customerId,
        failureCode,
      ),
    );
  }

  /**
   * 결제가 안 된 주문을 다른 카드로 다시 요청한다. 다시 배차 대기 목록에 올라가고 기사들에게 콜이 다시 간다.
   * 요청 시각(주문번호의 날짜)은 바꾸지 않는다.
   */
  retryPayment(customerId: string, paymentMethodId: string, now: Date): void {
    this.assertOwner(customerId);
    this.assertStatus([OrderStatus.PAYMENT_FAILED], 'ORDER_NOT_PAYMENT_FAILED');
    this.state.status = OrderStatus.REQUESTED;
    this.state.paymentMethodId = paymentMethodId;
    this.state.paymentFailureCode = null;
    this.raiseRequested(now);
  }

  /** 기사가 픽업지로 출발한다. 이때부터 취소 수수료가 붙는다. */
  depart(driverId: string, now: Date): void {
    this.assertAssignedDriver(driverId);
    this.assertStatus([OrderStatus.ASSIGNED], 'ORDER_NOT_AWAITING_DEPARTURE');
    this.state.status = OrderStatus.DEPARTED;
    this.state.departedAt = now;
    this.raise(
      new OrderDepartedEvent(this.id, now, this.state.customerId, driverId),
    );
  }

  /** 기사가 픽업지에 도착한다. 출발을 누르지 않았으면 지금 출발한 것으로 본다. */
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

  /**
   * 배차된 기사가 화물을 픽업한다. 기사가 넣은 추가 요금과, 도착한 뒤 기다린 시간의 대기료가 붙는다.
   * 도착을 누르지 않았으면 지금 도착한 것으로 본다 (기다린 시간 없음).
   */
  pickUp(
    driverId: string,
    now: Date,
    extraItems: ExtraItems = NO_EXTRA_ITEMS,
  ): void {
    this.assertAssignedDriver(driverId);
    if (!this.isAwaitingPickup()) {
      throw new ConflictError(
        'ORDER_NOT_AWAITING_PICKUP',
        '픽업할 수 있는 상태가 아니에요.',
      );
    }
    ChargePolicy.assertExtraItems(extraItems);
    this.state.departedAt ??= now;
    this.state.arrivedAt ??= now;
    const waitingMinutes = ChargePolicy.waitingMinutes(
      this.state.arrivedAt,
      now,
    );
    this.state.status = OrderStatus.PICKED_UP;
    this.state.pickedUpAt = now;
    this.state.extraItems = { ...extraItems };
    this.state.extraFee = Money.won(ChargePolicy.extraFee(extraItems));
    this.state.waitingMinutes = waitingMinutes;
    this.state.waitingFee = Money.won(ChargePolicy.waitingFee(waitingMinutes));
    this.raise(
      new OrderPickedUpEvent(
        this.id,
        now,
        this.state.customerId,
        driverId,
        this.state.extraFee.amount + this.state.waitingFee.amount,
      ),
    );
  }

  /** 배차된 기사가 배송을 완료한다. */
  deliver(driverId: string, now: Date): void {
    this.assertAssignedDriver(driverId);
    if (this.state.status !== OrderStatus.PICKED_UP) {
      throw new ConflictError(
        'ORDER_NOT_IN_TRANSIT',
        '픽업한 뒤에 배송을 완료할 수 있어요.',
      );
    }
    this.state.status = OrderStatus.DELIVERED;
    this.state.deliveredAt = now;
    this.raise(
      new OrderDeliveredEvent(this.id, now, this.state.customerId, driverId),
    );
  }

  /**
   * 기사가 도착하고 정해진 시간을 기다렸는데 고객이 나오지 않았다.
   * 요금 전액이 수수료가 된다 (배차 때 결제한 금액을 돌려주지 않는다).
   */
  reportNoShow(driverId: string, now: Date): void {
    this.assertAssignedDriver(driverId);
    this.assertStatus([OrderStatus.ARRIVED], 'ORDER_NOT_ARRIVED');
    if (!ChargePolicy.canReportNoShow(this.state.arrivedAt!, now)) {
      throw new ConflictError(
        'NO_SHOW_TOO_EARLY',
        '도착하고 30분이 지나야 노쇼를 신고할 수 있어요.',
      );
    }
    this.state.status = OrderStatus.NO_SHOW;
    this.state.noShowAt = now;
    this.state.cancellationFee = this.state.fare;
    this.raise(
      new OrderNoShowEvent(
        this.id,
        now,
        this.state.customerId,
        driverId,
        this.state.fare.amount,
      ),
    );
  }

  /**
   * 고객이 주문을 취소한다. 픽업하기 전까지만 할 수 있다.
   * 배차 전과 기사가 출발하기 전에는 수수료가 없고, 출발한 뒤에는 요금의 15%를 수수료로 뺀다.
   */
  cancelByCustomer(customerId: string, reason: string, now: Date): void {
    this.assertOwner(customerId);
    if (this.state.status === OrderStatus.PAYING) {
      throw new ConflictError(
        'PAYMENT_IN_PROGRESS',
        '배차하며 결제하는 중이에요. 잠시 뒤에 다시 시도해 주세요.',
      );
    }
    const fee = this.cancellationFeeNow();
    if (fee === null) {
      throw new ConflictError(
        'ORDER_NOT_CANCELLABLE',
        '픽업 이후에는 취소할 수 없어요.',
      );
    }
    const charged = this.wasCharged();
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
        charged ? this.state.fare.amount - fee : 0,
      ),
    );
  }

  snapshot(): Readonly<OrderState> {
    return { ...this.state };
  }

  private raiseRequested(now: Date): void {
    this.raise(
      new OrderRequestedEvent(
        this.id,
        now,
        this.state.customerId,
        this.state.vehicleType,
        this.state.pickup.area,
        this.state.dropoff.area,
        this.state.fare.amount,
        {
          latitude: this.state.pickup.point.latitude,
          longitude: this.state.pickup.point.longitude,
        },
        DISPATCH_RADIUS_KM[this.state.vehicleType],
      ),
    );
  }

  private assertOwner(customerId: string): void {
    if (!this.isOwnedBy(customerId)) {
      throw new ForbiddenError('NOT_ORDER_OWNER', '내 주문만 바꿀 수 있어요.');
    }
  }

  private assertAssignedDriver(driverId: string): void {
    if (
      !this.isAssignedTo(driverId) ||
      this.state.status === OrderStatus.PAYING
    ) {
      throw new ForbiddenError(
        'NOT_ASSIGNED_DRIVER',
        '배차받은 주문만 처리할 수 있어요.',
      );
    }
  }

  private assertStatus(allowed: OrderStatus[], code: string): void {
    if (!allowed.includes(this.state.status)) {
      throw new ConflictError(code, '지금 상태에서는 할 수 없어요.');
    }
  }
}
