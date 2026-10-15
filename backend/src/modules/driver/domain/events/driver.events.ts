import { DomainEvent } from '../../../../common/domain/domain-event.js';

/** 운영자가 기사 등록(또는 차량 변경)을 승인했다. */
export class DriverApprovedEvent extends DomainEvent {
  static readonly EVENT_NAME = 'driver.approved';
  readonly eventName = DriverApprovedEvent.EVENT_NAME;

  constructor(
    driverId: string,
    occurredAt: Date,
    readonly userId: string,
  ) {
    super(driverId, occurredAt);
  }
}

/** 운영자가 기사 등록(또는 차량 변경)을 반려했다. */
export class DriverRejectedEvent extends DomainEvent {
  static readonly EVENT_NAME = 'driver.rejected';
  readonly eventName = DriverRejectedEvent.EVENT_NAME;

  constructor(
    driverId: string,
    occurredAt: Date,
    readonly userId: string,
    readonly reason: string,
  ) {
    super(driverId, occurredAt);
  }
}
