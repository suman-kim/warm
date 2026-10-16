import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import {
  DOMAIN_EVENT_PUBLISHER,
  type DomainEventPublisher,
} from '../../../../common/application/domain-event-publisher.port.js';
import {
  PageQuery,
  toPageRequest,
} from '../../../../common/application/page.js';
import { ConflictError } from '../../../../common/domain/domain-error.js';
import { addDays, parseKstDate } from '../../../../common/domain/kst.js';
import {
  FoodOrderCanceller,
  FoodOrderStatus,
} from '../../domain/entities/food-order.entity.js';
import {
  FOOD_ORDER_REPOSITORY,
  type FoodOrderRepository,
} from '../../domain/repositories/marketplace.repositories.js';
import {
  FoodOrderDetailResult,
  FoodOrderSummaryResult,
  Page,
} from '../dto/marketplace.result.js';
import { FoodOrderAccess } from '../services/food-order-access.js';
import { FoodOrderDeliveries } from '../services/food-order-deliveries.js';
import { FoodOrderRefunds } from '../services/food-order-refunds.js';
import { FoodOrderViews } from '../services/food-order-views.js';
import { OwnedStore } from '../services/owned-store.js';

/** 가게 앱의 주문 탭. */
export enum StoreFoodOrderTab {
  /** 새 주문 — 받거나 거절한다 */
  NEW = 'NEW',
  /** 조리 중 (받았고 라이더가 아직 픽업하지 않았다) */
  COOKING = 'COOKING',
  /** 배달 중 */
  DELIVERING = 'DELIVERING',
  /** 완료·거절·취소 */
  DONE = 'DONE',
}

const TAB_STATUSES: Record<StoreFoodOrderTab, FoodOrderStatus[]> = {
  [StoreFoodOrderTab.NEW]: [FoodOrderStatus.PLACED],
  [StoreFoodOrderTab.COOKING]: [FoodOrderStatus.ACCEPTED],
  [StoreFoodOrderTab.DELIVERING]: [FoodOrderStatus.PICKED_UP],
  [StoreFoodOrderTab.DONE]: [
    FoodOrderStatus.DELIVERED,
    FoodOrderStatus.REJECTED,
    FoodOrderStatus.CANCELLED,
  ],
};

/** 사장님의 주문 접수: 새 주문 받기(조리 시간 → 배달 자동 요청)·거절·취소, 주문 목록·상세. */
@Injectable()
export class StoreFoodOrdersUseCase {
  constructor(
    private readonly owned: OwnedStore,
    private readonly access: FoodOrderAccess,
    private readonly views: FoodOrderViews,
    private readonly refunds: FoodOrderRefunds,
    private readonly linked: FoodOrderDeliveries,
    @Inject(FOOD_ORDER_REPOSITORY)
    private readonly orders: FoodOrderRepository,
    @Inject(DOMAIN_EVENT_PUBLISHER)
    private readonly eventPublisher: DomainEventPublisher,
  ) {}

  /** 탭별 주문. date(한국 날짜)를 주면 그날 들어온 주문만. 새 주문은 먼저 온 것이 위다. */
  async list(
    ownerUserId: string,
    filter: { tab?: StoreFoodOrderTab; date?: string },
    page: PageQuery,
  ): Promise<
    Page<FoodOrderSummaryResult> & { counts: Record<StoreFoodOrderTab, number> }
  > {
    const store = await this.owned.store(ownerUserId);
    const day = filter.date ? parseKstDate(filter.date) : null;
    const range = day ? { from: day, to: addDays(day, 1) } : {};
    const result = await this.orders.find(
      {
        storeId: store.id,
        paidOnly: true,
        statuses: filter.tab ? TAB_STATUSES[filter.tab] : undefined,
        ...range,
      },
      toPageRequest(page),
    );
    const counts = {} as Record<StoreFoodOrderTab, number>;
    for (const tab of Object.values(StoreFoodOrderTab)) {
      counts[tab] = (
        await this.orders.find(
          {
            storeId: store.id,
            paidOnly: true,
            statuses: TAB_STATUSES[tab],
            ...range,
          },
          { offset: 0, limit: 1 },
        )
      ).total;
    }
    const items =
      filter.tab === StoreFoodOrderTab.NEW
        ? [...result.items].reverse()
        : result.items;
    return {
      items: await this.views.summaries(items, 'STORE'),
      total: result.total,
      page: page.page,
      size: page.size,
      counts,
    };
  }

  async detail(
    ownerUserId: string,
    orderId: string,
  ): Promise<FoodOrderDetailResult> {
    return this.views.detail(
      await this.access.ofStoreOwner(ownerUserId, orderId),
      'STORE',
    );
  }

  /** 주문을 받는다. 조리 시간을 정하면 그 시간에 맞춰 라이더 배달이 자동으로 요청된다. */
  async accept(
    ownerUserId: string,
    orderId: string,
    cookMinutes: number,
  ): Promise<FoodOrderDetailResult> {
    const order = await this.access.ofStoreOwner(ownerUserId, orderId);
    if (order.status !== FoodOrderStatus.PLACED) {
      throw new ConflictError(
        'FOOD_ORDER_NOT_PLACED',
        '이미 처리한 주문이에요.',
      );
    }
    const deliveryId = await this.linked.request(order, cookMinutes);
    try {
      order.accept(cookMinutes, deliveryId, new Date());
      await this.orders.save(order);
    } catch (error) {
      // 그사이 손님이 취소했거나 값이 틀렸으면 방금 요청한 배달을 거둔다.
      await this.linked
        .cancelById(deliveryId, '주문 접수 실패')
        .catch(() => undefined);
      throw error;
    }
    await this.eventPublisher.publishAll(order.pullDomainEvents());
    return this.views.detail(order, 'STORE');
  }

  /** 받지 않는다 (사유 필수). 손님에게 모두 돌려준다. */
  async reject(
    ownerUserId: string,
    orderId: string,
    reason: string,
  ): Promise<FoodOrderDetailResult> {
    const order = await this.access.ofStoreOwner(ownerUserId, orderId);
    order.reject(reason, randomUUID(), new Date());
    await this.orders.save(order);
    await this.eventPublisher.publishAll(order.pullDomainEvents());
    await this.refunds.settle(order);
    return this.views.detail(order, 'STORE');
  }

  /**
   * 받은 주문을 취소한다 (라이더 픽업 전까지). 손님에게 모두 돌려주고 배달도 취소한다.
   * 라이더가 출발한 뒤면 배달 취소 수수료를 가게 정산에서 뺀다.
   */
  async cancel(
    ownerUserId: string,
    orderId: string,
    reason: string,
  ): Promise<FoodOrderDetailResult> {
    const order = await this.access.ofStoreOwner(ownerUserId, orderId);
    if (order.status !== FoodOrderStatus.ACCEPTED) {
      throw new ConflictError(
        'FOOD_ORDER_NOT_CANCELLABLE',
        order.status === FoodOrderStatus.PLACED
          ? '받기 전의 주문은 거절해 주세요.'
          : '라이더가 픽업한 뒤에는 취소할 수 없어요.',
      );
    }
    const fee = await this.linked.cancel(order, reason || '가게 사정으로 취소');
    order.cancel(FoodOrderCanceller.STORE, reason, randomUUID(), new Date());
    await this.orders.save(order);
    await this.eventPublisher.publishAll(order.pullDomainEvents());
    await this.linked.chargeCancellationFee(order, fee);
    await this.refunds.settle(order);
    return this.views.detail(order, 'STORE');
  }
}
