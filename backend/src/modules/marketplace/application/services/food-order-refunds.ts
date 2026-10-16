import { Inject, Injectable, Logger } from '@nestjs/common';
import { FoodOrder } from '../../domain/entities/food-order.entity.js';
import {
  FOOD_ORDER_REPOSITORY,
  type FoodOrderRepository,
} from '../../domain/repositories/marketplace.repositories.js';
import {
  PAYMENT_GATEWAY,
  type PaymentGateway,
} from '../ports/payment-gateway.port.js';

/**
 * 저장한 환불을 PG에 요청한다. 주문 상태(취소·거절)를 먼저 저장해 동시에 들어온 접수와 겨루고,
 * 이긴 뒤에만 돈을 돌려준다. PG가 거절하면 FAILED로 남겨 운영자가 다시 시도한다.
 */
@Injectable()
export class FoodOrderRefunds {
  private readonly logger = new Logger(FoodOrderRefunds.name);

  constructor(
    @Inject(PAYMENT_GATEWAY)
    private readonly gateway: PaymentGateway,
    @Inject(FOOD_ORDER_REPOSITORY)
    private readonly orders: FoodOrderRepository,
  ) {}

  async settle(order: FoodOrder): Promise<void> {
    const refunds = order.unsettledRefunds;
    if (refunds.length === 0) return;
    for (const refund of refunds) {
      try {
        await this.gateway.cancel({
          paymentId: order.paymentId,
          amount: refund.amount,
          reason: refund.reason,
          cancellableAmount: order.gatewayCancellableAmount,
        });
        order.completeRefund(refund.id, new Date());
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.error(
          `환불 실패 (${order.id}, ${refund.amount}원): ${message}`,
        );
        order.failRefund(refund.id, message);
      }
    }
    await this.orders.save(order);
  }
}
