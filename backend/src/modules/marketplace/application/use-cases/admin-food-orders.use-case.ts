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
import { addDays, parseKstDate } from '../../../../common/domain/kst.js';
import { MarketplacePolicyService } from '../../../platform-policy/application/marketplace-policy.service.js';
import {
  FoodOrderCanceller,
  FoodOrderStatus,
  RefundBearer,
} from '../../domain/entities/food-order.entity.js';
import {
  FOOD_ORDER_REPOSITORY,
  type FoodOrderFilter,
  type FoodOrderRepository,
  STORE_SETTLEMENT_REPOSITORY,
  type StoreSettlementRepository,
} from '../../domain/repositories/marketplace.repositories.js';
import {
  chargeEntry,
  payoutDueOn,
  StoreSettlementEntryKind,
} from '../../domain/services/store-settlement.js';
import {
  FoodOrderDetailResult,
  FoodOrderSummaryResult,
  Page,
} from '../dto/marketplace.result.js';
import { FoodOrderAccess } from '../services/food-order-access.js';
import { FoodOrderDeliveries } from '../services/food-order-deliveries.js';
import { FoodOrderRefunds } from '../services/food-order-refunds.js';
import { FoodOrderViews } from '../services/food-order-views.js';

export interface AdminFoodOrderFilter {
  status?: FoodOrderStatus;
  storeId?: string;
  consumerUserId?: string;
  /** 가게 접수 지연 (결제하고 정책의 분이 지나도록 받지 않은 주문)만 */
  late?: boolean;
  /** 환불이 실패한 주문만 */
  refundFailed?: boolean;
  /** 한국 날짜 범위 (to 포함) */
  from?: string;
  to?: string;
}

/** 운영자의 주문 관제: 목록(접수 지연·결제 이탈·환불 실패), 상세, 취소, 부분 환불, 환불 다시 시도. */
@Injectable()
export class AdminFoodOrdersUseCase {
  constructor(
    private readonly access: FoodOrderAccess,
    private readonly views: FoodOrderViews,
    private readonly refunds: FoodOrderRefunds,
    private readonly linked: FoodOrderDeliveries,
    private readonly policy: MarketplacePolicyService,
    @Inject(FOOD_ORDER_REPOSITORY)
    private readonly orders: FoodOrderRepository,
    @Inject(STORE_SETTLEMENT_REPOSITORY)
    private readonly settlements: StoreSettlementRepository,
    @Inject(DOMAIN_EVENT_PUBLISHER)
    private readonly eventPublisher: DomainEventPublisher,
  ) {}

  async list(
    filter: AdminFoodOrderFilter,
    page: PageQuery,
  ): Promise<
    Page<FoodOrderSummaryResult> & {
      lateCount: number;
      acceptLateMinutes: number;
    }
  > {
    const policy = await this.policy.current();
    const lateBefore = new Date(
      Date.now() - policy.storeAcceptLateMinutes * 60_000,
    );
    const from = filter.from ? parseKstDate(filter.from) : null;
    const to = filter.to ? parseKstDate(filter.to) : null;
    const query: FoodOrderFilter = {
      storeId: filter.storeId,
      consumerUserId: filter.consumerUserId,
      statuses: filter.late
        ? [FoodOrderStatus.PLACED]
        : filter.status
          ? [filter.status]
          : undefined,
      placedBefore: filter.late ? lateBefore : undefined,
      refundFailed: filter.refundFailed,
      from: from ?? undefined,
      to: to ? addDays(to, 1) : undefined,
    };
    const result = await this.orders.find(query, toPageRequest(page));
    const late = await this.orders.find(
      { statuses: [FoodOrderStatus.PLACED], placedBefore: lateBefore },
      { offset: 0, limit: 1 },
    );
    return {
      items: await this.views.summaries(result.items, 'ADMIN'),
      total: result.total,
      page: page.page,
      size: page.size,
      lateCount: late.total,
      acceptLateMinutes: policy.storeAcceptLateMinutes,
    };
  }

  async detail(orderId: string): Promise<FoodOrderDetailResult> {
    return this.views.detail(await this.access.any(orderId), 'ADMIN');
  }

  /** 픽업 전까지 취소한다. 손님에게 모두 돌려주고 배달도 취소한다. 배달 취소 수수료는 플랫폼이 낸다. */
  async cancel(
    orderId: string,
    reason: string,
  ): Promise<FoodOrderDetailResult> {
    const order = await this.access.any(orderId);
    if (order.status === FoodOrderStatus.ACCEPTED) {
      await this.linked.cancel(order, reason || '운영자 취소');
    }
    order.cancel(FoodOrderCanceller.ADMIN, reason, randomUUID(), new Date());
    await this.orders.save(order);
    await this.eventPublisher.publishAll(order.pullDomainEvents());
    await this.refunds.settle(order);
    return this.views.detail(order, 'ADMIN');
  }

  /** 배달이 끝난 주문의 일부를 돌려준다. 가게가 떠안으면 가게 정산에서 뺀다. */
  async refund(
    adminId: string,
    orderId: string,
    input: { amount: number; reason: string; borneBy: RefundBearer },
  ): Promise<FoodOrderDetailResult> {
    const order = await this.access.any(orderId);
    const now = new Date();
    const refund = order.refundPartially({
      id: randomUUID(),
      amount: input.amount,
      reason: input.reason,
      borneBy: input.borneBy,
      adminId,
      now,
    });
    await this.orders.save(order);
    if (input.borneBy === RefundBearer.STORE) {
      await this.settlements.addEntry(
        chargeEntry({
          id: randomUUID(),
          storeId: order.storeId,
          foodOrderId: order.id,
          kind: StoreSettlementEntryKind.REFUND,
          amount: refund.amount,
          memo: `주문 ${order.code} 부분 환불: ${refund.reason}`,
          dueOn: payoutDueOn(now, await this.policy.current()),
          now,
        }),
      );
    }
    await this.refunds.settle(order);
    return this.views.detail(order, 'ADMIN');
  }

  /** 실패한 환불을 PG에 다시 요청한다. */
  async retryRefunds(orderId: string): Promise<FoodOrderDetailResult> {
    const order = await this.access.any(orderId);
    await this.refunds.settle(order);
    return this.views.detail(order, 'ADMIN');
  }
}
