import { Inject, Injectable } from '@nestjs/common';
import { ChargeKind } from '../../../payment/domain/entities/order-charge.entity.js';
import {
  ExtraItems,
  NO_EXTRA_ITEMS,
} from '../../domain/services/charge-policy.js';
import { DriverOrderResult } from '../dto/order.result.js';
import {
  ORDER_PAYMENTS,
  type OrderPayments,
} from '../ports/order-payments.port.js';
import { DriverOrderTransition } from '../services/driver-order-transition.js';

/**
 * 픽업 완료 유스케이스 (기사). 화물을 실었다.
 * 기사가 넣은 추가 요금(과적·큰 짐·계단)과 도착 뒤 기다린 시간의 대기료를 더해, 배차 때 쓴 카드로 한 번 더 결제한다.
 * 추가 결제가 안 돼도 픽업은 그대로 진행한다 — 결제가 안 된 금액은 주문에 남고 고객과 운영자가 본다.
 */
@Injectable()
export class PickUpOrderUseCase {
  constructor(
    private readonly transition: DriverOrderTransition,
    @Inject(ORDER_PAYMENTS)
    private readonly payments: OrderPayments,
  ) {}

  execute(
    userId: string,
    orderId: string,
    extraItems: ExtraItems = NO_EXTRA_ITEMS,
  ): Promise<DriverOrderResult> {
    return this.transition.run(
      userId,
      orderId,
      (order, driver, now) => order.pickUp(driver.id, now, extraItems),
      async (order) => {
        const additional = order.totalFare - order.fare;
        if (additional > 0) {
          await this.payments.charge({
            orderId: order.id,
            customerId: order.customerId,
            paymentMethodId: order.paymentMethodId,
            kind: ChargeKind.ADDITIONAL,
            amount: additional,
            orderName: `${order.chargeName} 추가 요금`,
            routeLabel: order.routeLabel,
          });
        }
      },
    );
  }
}
