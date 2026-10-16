import { Injectable } from '@nestjs/common';
import { DriverOrderResult } from '../dto/order.result.js';
import { DriverOrderTransition } from '../services/driver-order-transition.js';

/**
 * 라이더의 픽업 전 단계 유스케이스: (출발) → 가게 도착.
 * 출발·도착하면 가게에 알림이 가고 취소 수수료가 붙기 시작한다.
 */
@Injectable()
export class AdvanceOrderStageUseCase {
  constructor(private readonly transition: DriverOrderTransition) {}

  depart(userId: string, orderId: string): Promise<DriverOrderResult> {
    return this.transition.run(userId, orderId, (order, driver, now) =>
      order.depart(driver.id, now),
    );
  }

  arrive(userId: string, orderId: string): Promise<DriverOrderResult> {
    return this.transition.run(userId, orderId, (order, driver, now) =>
      order.arrive(driver.id, now),
    );
  }
}
