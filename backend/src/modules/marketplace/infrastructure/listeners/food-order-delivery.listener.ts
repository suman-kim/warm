import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  OrderDeliveredEvent,
  OrderPickedUpEvent,
} from '../../../order/domain/events/order.events.js';
import { FoodOrderDeliveries } from '../../application/services/food-order-deliveries.js';

/** 배달 컨텍스트의 픽업·완료 이벤트를 주문앱 주문에 반영한다. 주문앱에서 온 배달이 아니면 지나친다. */
@Injectable()
export class FoodOrderDeliveryListener {
  private readonly logger = new Logger(FoodOrderDeliveryListener.name);

  constructor(private readonly deliveries: FoodOrderDeliveries) {}

  // 라이더의 픽업·완료 요청 안에서 끝낸다 — 응답을 받은 앱이 주문 상태를 바로 다시 읽어도 맞다.
  // 실패해도 라이더의 요청은 성공으로 두고 기록만 남긴다.
  @OnEvent(OrderPickedUpEvent.EVENT_NAME)
  async onPickedUp(event: OrderPickedUpEvent): Promise<void> {
    await this.run(event.eventName, event.aggregateId, () =>
      this.deliveries.pickedUp(event.aggregateId, event.occurredAt),
    );
  }

  @OnEvent(OrderDeliveredEvent.EVENT_NAME)
  async onDelivered(event: OrderDeliveredEvent): Promise<void> {
    await this.run(event.eventName, event.aggregateId, () =>
      this.deliveries.delivered(event.aggregateId, event.occurredAt),
    );
  }

  private async run(
    name: string,
    deliveryId: string,
    task: () => Promise<void>,
  ): Promise<void> {
    try {
      await task();
    } catch (error) {
      this.logger.error(
        `${name} 반영 실패 (배달 ${deliveryId})`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
