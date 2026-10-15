import { Inject, Injectable } from '@nestjs/common';
import {
  ORDER_REPOSITORY,
  type OrderRepository,
} from '../../domain/repositories/order.repository.js';
import {
  RecentDestinationResult,
  toWaypointResult,
} from '../dto/order.result.js';

/** 최근 주문 몇 건까지 뒤져서 보낸 곳을 뽑는지. */
const LOOKBACK_ORDERS = 30;

/** 최근 보낸 곳 조회 유스케이스 (고객). 지난 주문의 도착지를 주소별로 한 번씩 준다. */
@Injectable()
export class ListRecentDestinationsUseCase {
  constructor(
    @Inject(ORDER_REPOSITORY)
    private readonly orderRepository: OrderRepository,
  ) {}

  async execute(
    customerId: string,
    limit: number,
  ): Promise<RecentDestinationResult[]> {
    const orders = await this.orderRepository.findRecentByCustomer(
      customerId,
      LOOKBACK_ORDERS,
    );
    const byAddress = new Map<string, RecentDestinationResult>();
    for (const order of orders) {
      const { dropoff, requestedAt } = order.snapshot();
      const key = `${dropoff.address}|${dropoff.detailAddress ?? ''}`;
      if (!byAddress.has(key)) {
        byAddress.set(key, {
          ...toWaypointResult(dropoff),
          lastUsedAt: requestedAt,
        });
      }
    }
    return [...byAddress.values()].slice(0, limit);
  }
}
