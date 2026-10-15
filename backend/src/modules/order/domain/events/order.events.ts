import { DomainEvent } from '../../../../common/domain/domain-event.js';
import { VehicleType } from '../../../../common/domain/vehicle-type.js';

/**
 * 고객이 배송을 요청했다 — 해당 차종 기사에게 새 주문을 알릴 시점.
 * 위치는 동 단위까지만 싣는다 (배차 대기 목록에 보이는 범위).
 */
export class OrderRequestedEvent extends DomainEvent {
  static readonly EVENT_NAME = 'order.requested';
  readonly eventName = OrderRequestedEvent.EVENT_NAME;

  constructor(
    orderId: string,
    occurredAt: Date,
    readonly customerId: string,
    readonly vehicleType: VehicleType,
    readonly pickupArea: string,
    readonly dropoffArea: string,
    readonly fareAmount: number,
    /** 픽업지 좌표. 새 주문 알림을 이 근처의 기사에게만 보낸다. */
    readonly pickupPoint: { latitude: number; longitude: number },
    /** 배차 반경(km) — 픽업지에서 이 거리 안의 기사에게 알린다. */
    readonly dispatchRadiusKm: number,
  ) {
    super(orderId, occurredAt);
  }
}

/** 기사가 주문을 수락했다 (배차 완료). */
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

/** 배차 때 고객의 카드 결제가 안 됐다 — 배차되지 않았다. */
export class OrderPaymentFailedEvent extends DomainEvent {
  static readonly EVENT_NAME = 'order.payment-failed';
  readonly eventName = OrderPaymentFailedEvent.EVENT_NAME;
  constructor(
    orderId: string,
    occurredAt: Date,
    readonly customerId: string,
    /** 결제 실패 사유 코드 (PaymentFailureCode) */
    readonly failureCode: string,
  ) {
    super(orderId, occurredAt);
  }
}

/** 기사가 픽업지로 출발했다 — 이때부터 취소 수수료가 붙는다. */
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

/** 기사가 픽업지에 도착했다 — 대기 시간이 흐르기 시작한다. */
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

/** 기사가 화물을 픽업했다 (배송 시작). 추가 요금과 대기료가 있으면 [additionalAmount]만큼 더 결제한다. */
export class OrderPickedUpEvent extends DomainEvent {
  static readonly EVENT_NAME = 'order.picked-up';
  readonly eventName = OrderPickedUpEvent.EVENT_NAME;
  constructor(
    orderId: string,
    occurredAt: Date,
    readonly customerId: string,
    readonly driverId: string,
    readonly additionalAmount: number = 0,
  ) {
    super(orderId, occurredAt);
  }
}

/** 기사가 도착하고 기다렸는데 고객이 나오지 않았다 — 요금 전액을 받는다. */
export class OrderNoShowEvent extends DomainEvent {
  static readonly EVENT_NAME = 'order.no-show';
  readonly eventName = OrderNoShowEvent.EVENT_NAME;
  constructor(
    orderId: string,
    occurredAt: Date,
    readonly customerId: string,
    readonly driverId: string,
    readonly fareAmount: number,
  ) {
    super(orderId, occurredAt);
  }
}

/** 배송이 끝났다. */
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
 * 고객이 주문을 취소했다. 배차된 뒤였다면 driverId가 있다.
 * 결제한 뒤였다면 [refundAmount]만큼 돌려주고, [cancellationFee]는 수수료로 남는다.
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

/** 고객과 기사 사이에 메시지가 오갔다 — 받는 쪽에 알릴 시점. */
export class OrderMessageSentEvent extends DomainEvent {
  static readonly EVENT_NAME = 'order.message-sent';
  readonly eventName = OrderMessageSentEvent.EVENT_NAME;

  constructor(
    orderId: string,
    occurredAt: Date,
    readonly recipientUserId: string,
    readonly senderName: string,
    readonly text: string,
  ) {
    super(orderId, occurredAt);
  }
}
