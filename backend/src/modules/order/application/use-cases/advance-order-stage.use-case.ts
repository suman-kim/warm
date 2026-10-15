import { Injectable } from '@nestjs/common';
import { DriverOrderResult } from '../dto/order.result.js';
import { DriverOrderTransition } from '../services/driver-order-transition.js';

/**
 * 기사의 픽업 전 단계 유스케이스: 출발 → 도착, 그리고 노쇼 신고.
 * 출발하면 고객에게 알림이 가고 취소 수수료가 붙기 시작한다. 도착하면 대기 시간이 흐른다.
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

  /** 도착하고 30분이 지나도 고객이 나오지 않았다. 배차 때 결제한 요금을 돌려주지 않는다. */
  reportNoShow(userId: string, orderId: string): Promise<DriverOrderResult> {
    return this.transition.run(userId, orderId, (order, driver, now) =>
      order.reportNoShow(driver.id, now),
    );
  }
}
