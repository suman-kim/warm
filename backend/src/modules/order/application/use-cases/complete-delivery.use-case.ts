import { Injectable } from '@nestjs/common';
import { CollectedMethod } from '../../domain/value-objects/store-delivery.js';
import { DriverOrderResult } from '../dto/order.result.js';
import { DriverOrderTransition } from '../services/driver-order-transition.js';

/**
 * 배송 완료 유스케이스 (기사). 픽업한 물건을 도착지에 전했다.
 * 만나서 결제하는 가게 배달이면 손님에게 받은 방식(현금·카드)과 금액을 함께 받는다.
 */
@Injectable()
export class CompleteDeliveryUseCase {
  constructor(private readonly transition: DriverOrderTransition) {}

  execute(
    userId: string,
    orderId: string,
    collection: { method: CollectedMethod; amount: number } | null = null,
  ): Promise<DriverOrderResult> {
    return this.transition.run(userId, orderId, (order, driver, now) =>
      order.deliver(driver.id, now, collection),
    );
  }
}
