import { DomainEvent } from '../../../../common/domain/domain-event.js';

/**
 * 가게가 배달을 요청했다 — 근처 라이더에게 새 콜을 알릴 시점.
 * 위치는 동 단위까지만 싣는다 (콜 목록에 보이는 범위).
 */
export class OrderRequestedEvent extends DomainEvent {
  static readonly EVENT_NAME = 'order.requested';
  readonly eventName = OrderRequestedEvent.EVENT_NAME;

  constructor(
    orderId: string,
    occurredAt: Date,
    readonly customerId: string,
    readonly pickupArea: string,
    readonly dropoffArea: string,
    readonly fareAmount: number,
    /** 가게 좌표. 새 콜 알림을 이 근처의 라이더에게만 보낸다. */
    readonly pickupPoint: { latitude: number; longitude: number },
    /** 배차 반경(km) — 가게에서 이 거리 안의 라이더에게 알린다. */
    readonly dispatchRadiusKm: number,
  ) {
    super(orderId, occurredAt);
  }
}

/** 라이더가 배달을 수락했다 (배차 완료). */
export class OrderAssignedEvent extends DomainEvent {
  static readonly EVENT_NAME = 'order.assigned';
  readonly eventName = OrderAssignedEvent.EVENT_NAME;

  constructor(
    orderId: string,
    occurredAt: Date,
    readonly customerId: string,
    readonly driverId: string,
  ) {
    super(orderId, occurredAt);
  }
}

/** 라이더가 가게로 출발했다 — 이때부터 취소 수수료가 붙는다. */
export class OrderDepartedEvent extends DomainEvent {
  static readonly EVENT_NAME = 'order.departed';
  readonly eventName = OrderDepartedEvent.EVENT_NAME;
  constructor(
    orderId: string,
    occurredAt: Date,
    readonly customerId: string,
    readonly driverId: string,
  ) {
    super(orderId, occurredAt);
  }
}

/** 라이더가 가게에 도착했다 — 이때부터 취소 수수료가 붙는다. */
export class OrderArrivedEvent extends DomainEvent {
  static readonly EVENT_NAME = 'order.arrived';
  readonly eventName = OrderArrivedEvent.EVENT_NAME;
  constructor(
    orderId: string,
    occurredAt: Date,
    readonly customerId: string,
    readonly driverId: string,
  ) {
    super(orderId, occurredAt);
  }
}

/** 라이더가 음식을 픽업했다 (배달 시작). */
export class OrderPickedUpEvent extends DomainEvent {
  static readonly EVENT_NAME = 'order.picked-up';
  readonly eventName = OrderPickedUpEvent.EVENT_NAME;
  constructor(
    orderId: string,
    occurredAt: Date,
    readonly customerId: string,
    readonly driverId: string,
  ) {
    super(orderId, occurredAt);
  }
}

/** 배달이 끝났다. */
export class OrderDeliveredEvent extends DomainEvent {
  static readonly EVENT_NAME = 'order.delivered';
  readonly eventName = OrderDeliveredEvent.EVENT_NAME;

  constructor(
    orderId: string,
    occurredAt: Date,
    readonly customerId: string,
    readonly driverId: string,
  ) {
    super(orderId, occurredAt);
  }
}

/**
 * 가게가 배달을 취소했다. 배차된 뒤였다면 driverId가 있다.
 * 대행료에서 [cancellationFee]를 뺀 [refundAmount]를 충전금으로 돌려준다.
 */
export class OrderCancelledEvent extends DomainEvent {
  static readonly EVENT_NAME = 'order.cancelled';
  readonly eventName = OrderCancelledEvent.EVENT_NAME;
  constructor(
    orderId: string,
    occurredAt: Date,
    readonly customerId: string,
    readonly driverId: string | null,
    readonly cancellationFee: number = 0,
    readonly refundAmount: number = 0,
  ) {
    super(orderId, occurredAt);
  }
}
