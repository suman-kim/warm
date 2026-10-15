import { DomainEvent } from './domain-event.js';

/**
 * 애그리거트 루트 기반 클래스.
 * 낙관적 잠금용 버전과, 아직 발행하지 않은 도메인 이벤트를 들고 있다.
 */
export abstract class AggregateRoot {
  private pendingEvents: DomainEvent[] = [];

  protected constructor(
    readonly id: string,
    private persistedVersion: number,
  ) {}

  /** 마지막으로 저장된 버전. 한 번도 저장하지 않았으면 0. */
  get version(): number {
    return this.persistedVersion;
  }

  /** 저장소가 저장에 성공한 뒤 부른다. */
  markPersisted(version: number): void {
    this.persistedVersion = version;
  }

  protected raise(event: DomainEvent): void {
    this.pendingEvents.push(event);
  }

  /** 쌓인 이벤트를 꺼내고 비운다. 저장 뒤 유스케이스가 발행한다. */
  pullDomainEvents(): DomainEvent[] {
    const events = this.pendingEvents;
    this.pendingEvents = [];
    return events;
  }
}
