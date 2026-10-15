import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DomainEventPublisher } from '../../application/domain-event-publisher.port.js';
import { DomainEvent } from '../../domain/domain-event.js';

/**
 * 프로세스 안에서 도메인 이벤트를 전달하는 발행기.
 * 리스너는 `@OnEvent(이벤트 이름)`으로 구독한다. 리스너의 오류는 요청을 실패시키지 않는다.
 */
@Injectable()
export class EventEmitterDomainEventPublisher implements DomainEventPublisher {
  constructor(private readonly emitter: EventEmitter2) {}

  async publishAll(events: DomainEvent[]): Promise<void> {
    for (const event of events) {
      await this.emitter.emitAsync(event.eventName, event);
    }
  }
}
