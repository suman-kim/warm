import { DomainEvent } from '../../../../common/domain/domain-event.js';

/** 손님이 결제를 마쳐 가게에 새 주문이 들어왔다. */
export class FoodOrderPlacedEvent extends DomainEvent {
  static readonly EVENT_NAME = 'food-order.placed';
  readonly eventName = FoodOrderPlacedEvent.EVENT_NAME;

  constructor(
    foodOrderId: string,
    occurredAt: Date,
    readonly storeOwnerUserId: string,
    /** 메뉴 요약 (예: 후라이드 치킨 외 2개) */
    readonly summary: string,
    readonly paymentAmount: number,
  ) {
    super(foodOrderId, occurredAt);
  }
}

/** 가게가 주문을 받았다 (조리 시작). */
export class FoodOrderAcceptedEvent extends DomainEvent {
  static readonly EVENT_NAME = 'food-order.accepted';
  readonly eventName = FoodOrderAcceptedEvent.EVENT_NAME;

  constructor(
    foodOrderId: string,
    occurredAt: Date,
    readonly consumerUserId: string,
    readonly storeName: string,
    readonly cookMinutes: number,
  ) {
    super(foodOrderId, occurredAt);
  }
}

/** 가게가 주문을 거절했다 (손님에게 전액 환불). */
export class FoodOrderRejectedEvent extends DomainEvent {
  static readonly EVENT_NAME = 'food-order.rejected';
  readonly eventName = FoodOrderRejectedEvent.EVENT_NAME;

  constructor(
    foodOrderId: string,
    occurredAt: Date,
    readonly consumerUserId: string,
    readonly storeName: string,
    readonly reason: string,
  ) {
    super(foodOrderId, occurredAt);
  }
}

/** 주문이 취소됐다. 누가 취소했는지에 따라 알림 받는 사람이 다르다. */
export class FoodOrderCancelledEvent extends DomainEvent {
  static readonly EVENT_NAME = 'food-order.cancelled';
  readonly eventName = FoodOrderCancelledEvent.EVENT_NAME;

  constructor(
    foodOrderId: string,
    occurredAt: Date,
    readonly consumerUserId: string,
    readonly storeOwnerUserId: string,
    readonly storeName: string,
    /** CONSUMER | STORE | ADMIN */
    readonly cancelledBy: string,
    /** 결제한 뒤의 취소인지 (결제 전 취소는 알릴 것이 없다) */
    readonly wasPaid: boolean,
  ) {
    super(foodOrderId, occurredAt);
  }
}

/** 라이더가 음식을 픽업했다. */
export class FoodOrderPickedUpEvent extends DomainEvent {
  static readonly EVENT_NAME = 'food-order.picked-up';
  readonly eventName = FoodOrderPickedUpEvent.EVENT_NAME;

  constructor(
    foodOrderId: string,
    occurredAt: Date,
    readonly consumerUserId: string,
    readonly storeName: string,
  ) {
    super(foodOrderId, occurredAt);
  }
}

/** 배달이 끝났다. */
export class FoodOrderDeliveredEvent extends DomainEvent {
  static readonly EVENT_NAME = 'food-order.delivered';
  readonly eventName = FoodOrderDeliveredEvent.EVENT_NAME;

  constructor(
    foodOrderId: string,
    occurredAt: Date,
    readonly consumerUserId: string,
    readonly storeName: string,
  ) {
    super(foodOrderId, occurredAt);
  }
}
