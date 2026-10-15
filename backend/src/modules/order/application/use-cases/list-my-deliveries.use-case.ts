import { Inject, Injectable } from '@nestjs/common';
import {
  PageQuery,
  toPageRequest,
} from '../../../../common/application/page.js';
import {
  ORDER_REPOSITORY,
  type OrderFilter,
  type OrderRepository,
  type Period,
} from '../../domain/repositories/order.repository.js';
import {
  SETTLEMENT_POLICY,
  type SettlementPolicy,
} from '../../domain/services/settlement-policy.js';
import { OrderPageResult, toDriverOrderResult } from '../dto/order.result.js';
import { DriverOrderTransition } from '../services/driver-order-transition.js';

/** 내 배송 목록 조회 유스케이스 (기사). 내가 배차받은 주문들이다. */
@Injectable()
export class ListMyDeliveriesUseCase {
  constructor(
    @Inject(ORDER_REPOSITORY)
    private readonly orderRepository: OrderRepository,
    @Inject(SETTLEMENT_POLICY)
    private readonly policy: SettlementPolicy,
    private readonly transition: DriverOrderTransition,
  ) {}

  async execute(
    userId: string,
    filter: OrderFilter & { period?: Period },
    page: PageQuery,
  ): Promise<OrderPageResult> {
    const driver = await this.transition.requireDriver(userId);
    const { items, total } = await this.orderRepository.findByDriver(
      driver.id,
      filter,
      toPageRequest(page),
    );
    return {
      items: items.map((order) => toDriverOrderResult(order, this.policy)),
      total,
      page: page.page,
      size: page.size,
    };
  }
}
