import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  DOMAIN_EVENT_PUBLISHER,
  type DomainEventPublisher,
} from '../../../../common/application/domain-event-publisher.port.js';
import {
  ConflictError,
  NotFoundError,
} from '../../../../common/domain/domain-error.js';
import { DeliverySource } from '../../domain/value-objects/store-delivery.js';
import {
  ORDER_REPOSITORY,
  type OrderRepository,
} from '../../domain/repositories/order.repository.js';
import { OrderResult, toOrderResult } from '../dto/order.result.js';
import {
  STORE_WALLET,
  type StoreWallet,
  walletMemo,
} from '../ports/store-wallet.port.js';

/**
 * 배달 취소 유스케이스 (사장님). 라이더가 픽업하기 전까지만 취소할 수 있다.
 * 취소 수수료(라이더 출발·도착 전 0원, 그 뒤 대행료의 15%)를 빼고 나머지를 충전금으로 돌려준다.
 */
@Injectable()
export class CancelOrderUseCase {
  private readonly logger = new Logger(CancelOrderUseCase.name);

  constructor(
    @Inject(ORDER_REPOSITORY)
    private readonly orderRepository: OrderRepository,
    @Inject(STORE_WALLET)
    private readonly wallet: StoreWallet,
    @Inject(DOMAIN_EVENT_PUBLISHER)
    private readonly eventPublisher: DomainEventPublisher,
  ) {}

  async execute(
    customerId: string,
    orderId: string,
    reason: string,
  ): Promise<OrderResult> {
    const order = await this.orderRepository.findById(orderId);
    // 남의 배달은 있는지도 알려주지 않는다.
    if (!order || !order.isOwnedBy(customerId)) {
      throw new NotFoundError('ORDER_NOT_FOUND', '배달을 찾을 수 없어요.');
    }
    // 주문앱 주문의 배달은 손님 환불과 함께 주문에서 취소한다.
    if (order.storeDelivery.source === DeliverySource.FOOD_ORDER) {
      throw new ConflictError(
        'LINKED_TO_FOOD_ORDER',
        '주문앱 주문의 배달은 주문 화면에서 취소해 주세요.',
      );
    }
    order.cancelByCustomer(customerId, reason, new Date());
    await this.orderRepository.save(order);
    await this.eventPublisher.publishAll(order.pullDomainEvents());
    const refund = order.refundDueOnCancel();
    if (refund > 0) {
      // 취소는 이미 저장됐다. 충전금으로 돌려주지 못하면 운영자가 충전금을 조정한다.
      const fee = order.snapshot().cancellationFee.amount;
      await this.wallet
        .refundDeliveryFee(
          order.storeDelivery.storeId,
          order.id,
          refund,
          walletMemo(
            order,
            fee
              ? `취소 수수료 ${fee.toLocaleString('ko-KR')}원을 뺐어요`
              : '라이더 출발 전 취소라 모두 돌려받았어요',
          ),
        )
        .catch((error: unknown) =>
          this.logger.error(`취소 환불 실패 (${order.id}, ${refund}원)`, error),
        );
    }
    return toOrderResult(order);
  }
}
