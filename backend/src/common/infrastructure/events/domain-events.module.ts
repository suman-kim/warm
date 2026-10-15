import { Global, Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { DOMAIN_EVENT_PUBLISHER } from '../../application/domain-event-publisher.port.js';
import { EventEmitterDomainEventPublisher } from './event-emitter-domain-event.publisher.js';

/** 도메인 이벤트 발행기를 전역으로 제공한다. */
@Global()
@Module({
  // wildcard: 리스너가 'order.*'처럼 컨텍스트 단위로 구독할 수 있다.
  imports: [EventEmitterModule.forRoot({ wildcard: true, delimiter: '.' })],
  providers: [
    {
      provide: DOMAIN_EVENT_PUBLISHER,
      useClass: EventEmitterDomainEventPublisher,
    },
  ],
  exports: [DOMAIN_EVENT_PUBLISHER],
})
export class DomainEventsModule {}
