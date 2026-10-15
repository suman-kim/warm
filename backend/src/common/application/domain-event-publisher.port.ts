import { DomainEvent } from '../domain/domain-event.js';

/** 도메인 이벤트 발행기 DI 토큰. */
export const DOMAIN_EVENT_PUBLISHER = Symbol('DOMAIN_EVENT_PUBLISHER');

/** 도메인 이벤트 발행 포트. 유스케이스가 애그리거트를 저장한 뒤 부른다. */
export interface DomainEventPublisher {
  publishAll(events: DomainEvent[]): Promise<void>;
}
