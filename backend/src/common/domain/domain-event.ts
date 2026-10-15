/** 애그리거트에서 일어난 일. 저장이 끝난 뒤 발행된다. */
export abstract class DomainEvent {
  /** 리스너가 구독하는 이름 (예: order.assigned). */
  abstract readonly eventName: string;

  constructor(
    readonly aggregateId: string,
    readonly occurredAt: Date,
  ) {}
}
