import { Inject, Injectable } from '@nestjs/common';
import {
  DOMAIN_EVENT_PUBLISHER,
  type DomainEventPublisher,
} from '../../../../common/application/domain-event-publisher.port.js';
import {
  ConflictError,
  NotFoundError,
} from '../../../../common/domain/domain-error.js';
import {
  ORDER_REPOSITORY,
  type OrderRepository,
} from '../../domain/repositories/order.repository.js';
import { OrderResult, toOrderResult } from '../dto/order.result.js';
import {
  ORDER_PAYMENTS,
  type OrderPayments,
} from '../ports/order-payments.port.js';

/**
 * 다른 카드로 다시 요청 유스케이스 (고객).
 * 배차 때 결제가 안 된 주문을 고른 카드로 바꿔 다시 배차 대기 목록에 올린다. 기사들에게 콜이 다시 간다.
 */
@Injectable()
export class RetryPaymentUseCase {
  constructor(
    @Inject(ORDER_REPOSITORY)
    private readonly orderRepository: OrderRepository,
    @Inject(ORDER_PAYMENTS)
    private readonly payments: OrderPayments,
    @Inject(DOMAIN_EVENT_PUBLISHER)
    private readonly eventPublisher: DomainEventPublisher,
  ) {}

  async execute(
    customerId: string,
    orderId: string,
    paymentMethodId: string,
  ): Promise<OrderResult> {
    const order = await this.orderRepository.findById(orderId);
    if (!order || !order.isOwnedBy(customerId)) {
      throw new NotFoundError('ORDER_NOT_FOUND', '주문을 찾을 수 없어요.');
    }
    const card = await this.payments.cardFor(customerId, paymentMethodId);
    if (card?.paymentMethodId !== paymentMethodId) {
      throw new ConflictError(
        'PAYMENT_METHOD_REQUIRED',
        '고른 카드를 쓸 수 없어요. 카드를 다시 골라 주세요.',
      );
    }
    order.retryPayment(customerId, paymentMethodId, new Date());
    await this.orderRepository.save(order);
    await this.eventPublisher.publishAll(order.pullDomainEvents());
    return toOrderResult(order);
  }
}
