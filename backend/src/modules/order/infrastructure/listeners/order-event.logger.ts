import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { DomainEvent } from '../../../../common/domain/domain-event.js';

/**
 * 주문 도메인 이벤트를 로그로 남긴다.
 * 푸시 알림처럼 주문 상태 변화에 반응하는 기능은 이런 리스너로 붙인다.
 */
@Injectable()
export class OrderEventLogger {
  private readonly logger = new Logger(OrderEventLogger.name);

  @OnEvent('order.*')
  handle(event: DomainEvent): void {
    this.logger.log(`${event.eventName} order=${event.aggregateId}`);
  }
}
