import { Injectable } from '@nestjs/common';
import { DriverOrderResult } from '../dto/order.result.js';
import { DriverOrderTransition } from '../services/driver-order-transition.js';

/** 픽업 완료 유스케이스 (라이더). 가게에서 음식을 받았다. */
@Injectable()
export class PickUpOrderUseCase {
  constructor(private readonly transition: DriverOrderTransition) {}

  execute(userId: string, orderId: string): Promise<DriverOrderResult> {
    return this.transition.run(userId, orderId, (order, driver, now) =>
      order.pickUp(driver.id, now),
    );
  }
}
