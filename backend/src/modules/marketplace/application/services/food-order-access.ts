import { Inject, Injectable } from '@nestjs/common';
import { NotFoundError } from '../../../../common/domain/domain-error.js';
import { FoodOrder } from '../../domain/entities/food-order.entity.js';
import {
  FOOD_ORDER_REPOSITORY,
  type FoodOrderRepository,
} from '../../domain/repositories/marketplace.repositories.js';
import { OwnedStore } from './owned-store.js';

/** 주문을 찾고 보는 사람의 주문인지 확인한다. 남의 주문은 없는 것처럼 404로 답한다. */
@Injectable()
export class FoodOrderAccess {
  constructor(
    @Inject(FOOD_ORDER_REPOSITORY)
    private readonly orders: FoodOrderRepository,
    private readonly owned: OwnedStore,
  ) {}

  async any(orderId: string): Promise<FoodOrder> {
    const order = await this.orders.findById(orderId);
    if (!order) throw notFound();
    return order;
  }

  /** 손님의 주문. 결제하지 않은 주문은 결제 확인 전까지만 보인다. */
  async ofConsumer(userId: string, orderId: string): Promise<FoodOrder> {
    const order = await this.any(orderId);
    if (!order.isOrderedBy(userId)) throw notFound();
    return order;
  }

  /** 사장님 가게의 주문. 결제하지 않은 주문은 가게에 보이지 않는다. */
  async ofStoreOwner(ownerUserId: string, orderId: string): Promise<FoodOrder> {
    const store = await this.owned.store(ownerUserId);
    const order = await this.any(orderId);
    if (order.storeId !== store.id || !order.isPaid) throw notFound();
    return order;
  }
}

function notFound(): NotFoundError {
  return new NotFoundError('FOOD_ORDER_NOT_FOUND', '주문을 찾을 수 없어요.');
}
