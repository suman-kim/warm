import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { DomainEvent } from '../../../../common/domain/domain-event.js';
import { NotifyEventUseCase } from '../../application/use-cases/notify-event.use-case.js';

/** 주문·결제·기사 도메인 이벤트를 받아 알림으로 넘긴다. */
@Injectable()
export class EventPushListener implements OnModuleDestroy {
  private readonly logger = new Logger(EventPushListener.name);
  private readonly inFlight = new Set<Promise<void>>();

  constructor(private readonly notifyEventUseCase: NotifyEventUseCase) {}

  @OnEvent('order.*')
  @OnEvent('payment.*')
  @OnEvent('driver.*')
  handle(event: DomainEvent): void {
    // 발송을 기다리지 않는다 — API의 응답 시간이 푸시 서비스에 묶이지 않고,
    // 알림이 실패해도 이미 저장된 처리는 성공으로 끝난다.
    const task = this.notifyEventUseCase
      .execute(event)
      .catch((error: unknown) => {
        this.logger.error(
          `${event.eventName} 알림 실패 (${event.aggregateId})`,
          error instanceof Error ? error.stack : String(error),
        );
      })
      .finally(() => this.inFlight.delete(task));
    this.inFlight.add(task);
  }

  /** 서버가 내려갈 때 보내던 알림은 마저 보낸다 (DB 연결이 닫히기 전에 돈다). */
  async onModuleDestroy(): Promise<void> {
    await Promise.all(this.inFlight);
  }
}
