import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  DOMAIN_EVENT_PUBLISHER,
  type DomainEventPublisher,
} from '../../../../common/application/domain-event-publisher.port.js';
import { NotFoundError } from '../../../../common/domain/domain-error.js';
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
 * 주문 취소 유스케이스 (고객). 기사가 픽업하기 전까지만 취소할 수 있다.
 * 배차 때 결제했으면 취소 수수료(기사 출발 전 0원, 출발 뒤 요금의 15%)를 빼고 나머지를 카드로 돌려준다.
 */
@Injectable()
export class CancelOrderUseCase {
  private readonly logger = new Logger(CancelOrderUseCase.name);

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
    reason: string,
  ): Promise<OrderResult> {
    const order = await this.orderRepository.findById(orderId);
    // 남의 주문은 있는지도 알려주지 않는다.
    if (!order || !order.isOwnedBy(customerId)) {
      throw new NotFoundError('ORDER_NOT_FOUND', '주문을 찾을 수 없어요.');
    }
    order.cancelByCustomer(customerId, reason, new Date());
    await this.orderRepository.save(order);
    await this.eventPublisher.publishAll(order.pullDomainEvents());
    const refund = order.refundDueOnCancel();
    if (refund > 0) {
      // 취소는 이미 저장됐다. 환불이 안 되면 운영자가 주문 상세에서 돌려준다.
      await this.payments
        .refund({
          orderId: order.id,
          customerId,
          amount: refund,
          reason: order.snapshot().cancellationFee.amount
            ? '고객 취소 · 기사 출발 후 · 취소 수수료를 빼고 환불'
            : '고객 취소 · 기사 출발 전 · 전액 환불',
          cancellationFee: order.snapshot().cancellationFee.amount,
          actorId: null,
          routeLabel: order.routeLabel,
        })
        .catch((error: unknown) =>
          this.logger.error(`취소 환불 실패 (${order.id}, ${refund}원)`, error),
        );
    }
    return toOrderResult(order);
  }
}
