import { Injectable } from '@nestjs/common';
import { DriverOrderResult } from '../dto/order.result.js';
import { DriverOrderTransition } from '../services/driver-order-transition.js';

/** 배송 완료 유스케이스 (기사). 픽업한 화물을 도착지에 내렸다. */
@Injectable()
export class CompleteDeliveryUseCase {
  constructor(private readonly transition: DriverOrderTransition) {}

  execute(userId: string, orderId: string): Promise<DriverOrderResult> {
    return this.transition.run(userId, orderId, (order, driver, now) =>
      order.deliver(driver.id, now),
    );
  }
}
