import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import {
  DOMAIN_EVENT_PUBLISHER,
  type DomainEventPublisher,
} from '../../../../common/application/domain-event-publisher.port.js';
import { ConflictError } from '../../../../common/domain/domain-error.js';
import { LinkedDeliveryService } from '../../../order/application/services/linked-delivery.service.js';
import { OrderStatus } from '../../../order/domain/order-status.js';
import { MarketplacePolicyService } from '../../../platform-policy/application/marketplace-policy.service.js';
import { FoodOrder } from '../../domain/entities/food-order.entity.js';
import {
  FOOD_ORDER_REPOSITORY,
  type FoodOrderRepository,
  STORE_SETTLEMENT_REPOSITORY,
  type StoreSettlementRepository,
} from '../../domain/repositories/marketplace.repositories.js';
import {
  chargeEntry,
  payoutDueOn,
  saleEntry,
  StoreSettlementEntryKind,
} from '../../domain/services/store-settlement.js';

const MAX_FOOD_AMOUNT_ON_DELIVERY = 1_000_000;
const MAX_RIDER_MEMO = 500;
const RETRIES = 3;

/**
 * 주문과 배달을 잇는다: 가게가 받으면 배달을 요청하고, 취소하면 배달도 취소하며,
 * 라이더가 픽업·완료하면 주문에 반영하고 가게 정산 내역을 쌓는다.
 */
@Injectable()
export class FoodOrderDeliveries {
  constructor(
    private readonly deliveries: LinkedDeliveryService,
    private readonly policy: MarketplacePolicyService,
    @Inject(FOOD_ORDER_REPOSITORY)
    private readonly orders: FoodOrderRepository,
    @Inject(STORE_SETTLEMENT_REPOSITORY)
    private readonly settlements: StoreSettlementRepository,
    @Inject(DOMAIN_EVENT_PUBLISHER)
    private readonly eventPublisher: DomainEventPublisher,
  ) {}

  /** 배달을 요청하고 그 ID를 준다. 손님은 이미 결제했으므로 라이더가 받을 돈은 없다. */
  async request(order: FoodOrder, cookMinutes: number): Promise<string> {
    const state = order.snapshot();
    const quantity = state.lines.reduce((sum, line) => sum + line.quantity, 0);
    const memo = [
      `[따끈 ${order.code}] ${order.summary()} · 총 ${quantity}개 (결제 완료, 받을 돈 없음)`,
      state.riderRequest,
    ]
      .filter(Boolean)
      .join('\n')
      .slice(0, MAX_RIDER_MEMO);
    const delivery = await this.deliveries.request({
      storeId: state.storeId,
      sourceOrderId: state.id,
      dropoff: { ...state.dropoff, phone: state.consumerPhone },
      foodAmount: Math.min(state.paymentAmount, MAX_FOOD_AMOUNT_ON_DELIVERY),
      readyInMinutes: cookMinutes,
      memo,
    });
    return delivery.deliveryId;
  }

  /** 배달을 취소하고 붙은 취소 수수료를 준다. 이미 취소됐으면 그때의 수수료. 픽업 뒤에는 실패한다. */
  async cancel(order: FoodOrder, reason: string): Promise<number> {
    return order.deliveryOrderId
      ? this.cancelById(order.deliveryOrderId, reason)
      : 0;
  }

  async cancelById(deliveryId: string, reason: string): Promise<number> {
    const current = await this.deliveries.find(deliveryId);
    if (!current) return 0;
    if (current.status === OrderStatus.CANCELLED)
      return current.cancellationFee;
    return (await this.deliveries.cancel(deliveryId, reason)).cancellationFee;
  }

  /** 가게가 취소해 낸 배달 취소 수수료를 가게 정산에서 뺀다. */
  async chargeCancellationFee(order: FoodOrder, fee: number): Promise<void> {
    if (fee <= 0) return;
    if (
      await this.settlements.hasEntry(
        order.id,
        StoreSettlementEntryKind.CANCELLATION_FEE,
      )
    )
      return;
    const now = new Date();
    await this.settlements.addEntry(
      chargeEntry({
        id: randomUUID(),
        storeId: order.storeId,
        foodOrderId: order.id,
        kind: StoreSettlementEntryKind.CANCELLATION_FEE,
        amount: fee,
        memo: `주문 ${order.code} 배달 취소 수수료`,
        dueOn: payoutDueOn(now, await this.policy.current()),
        now,
      }),
    );
  }

  /** 라이더가 픽업했다 (배달 이벤트). */
  async pickedUp(deliveryId: string, at: Date): Promise<void> {
    await this.update(deliveryId, (order) => {
      order.markPickedUp(at);
      return true;
    });
  }

  /** 배달이 끝났다 (배달 이벤트). 주문을 완료하고 가게 정산 내역을 쌓는다. */
  async delivered(deliveryId: string, at: Date): Promise<void> {
    const order = await this.update(deliveryId, (each) =>
      each.markDelivered(at),
    );
    if (!order) return;
    if (
      await this.settlements.hasEntry(order.id, StoreSettlementEntryKind.SALE)
    )
      return;
    const delivery = await this.deliveries.find(deliveryId);
    await this.settlements.addEntry(
      saleEntry({
        id: randomUUID(),
        order: order.snapshot(),
        deliveryFee: delivery?.fare ?? 0,
        dueOn: payoutDueOn(at, await this.policy.current()),
        now: new Date(),
      }),
    );
  }

  /** 배달 ID로 주문을 찾아 바꾸고 저장한다. 그사이 다른 요청이 바꿨으면 다시 읽어 시도한다. */
  private async update(
    deliveryId: string,
    apply: (order: FoodOrder) => boolean,
  ): Promise<FoodOrder | null> {
    for (let attempt = 1; ; attempt++) {
      const order = await this.orders.findByDeliveryOrderId(deliveryId);
      if (!order) return null;
      if (!apply(order)) return order;
      try {
        await this.orders.save(order);
        await this.eventPublisher.publishAll(order.pullDomainEvents());
        return order;
      } catch (error) {
        const stale =
          error instanceof ConflictError && error.code === 'STALE_AGGREGATE';
        if (!stale || attempt >= RETRIES) throw error;
      }
    }
  }
}
