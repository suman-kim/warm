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
import { TrackingResult } from '../../../order/application/dto/order.result.js';
import { LinkedDeliveryService } from '../../../order/application/services/linked-delivery.service.js';
import { MarketplacePolicyService } from '../../../platform-policy/application/marketplace-policy.service.js';
import {
  USER_REPOSITORY,
  type UserRepository,
} from '../../../user/domain/repositories/user.repository.js';
import { FoodOrderCanceller } from '../../domain/entities/food-order.entity.js';
import { writeReview } from '../../domain/entities/review.entity.js';
import {
  FOOD_ORDER_REPOSITORY,
  type FoodOrderRepository,
  REVIEW_REPOSITORY,
  type ReviewRepository,
} from '../../domain/repositories/marketplace.repositories.js';
import {
  FoodOrderDetailResult,
  FoodOrderSummaryResult,
  Page,
  ReviewResult,
} from '../dto/marketplace.result.js';
import { FoodOrderAccess } from '../services/food-order-access.js';
import { FoodOrderRefunds } from '../services/food-order-refunds.js';
import { FoodOrderViews } from '../services/food-order-views.js';

/** 손님의 주문 내역·상세·라이더 위치·취소·리뷰. */
@Injectable()
export class ConsumerFoodOrdersUseCase {
  constructor(
    private readonly access: FoodOrderAccess,
    private readonly views: FoodOrderViews,
    private readonly refunds: FoodOrderRefunds,
    private readonly deliveries: LinkedDeliveryService,
    private readonly policy: MarketplacePolicyService,
    @Inject(FOOD_ORDER_REPOSITORY)
    private readonly orders: FoodOrderRepository,
    @Inject(REVIEW_REPOSITORY)
    private readonly reviews: ReviewRepository,
    @Inject(USER_REPOSITORY)
    private readonly users: UserRepository,
    @Inject(DOMAIN_EVENT_PUBLISHER)
    private readonly eventPublisher: DomainEventPublisher,
  ) {}

  /** 결제한 주문만, 최근 것부터 */
  async list(
    userId: string,
    page: PageQuery,
  ): Promise<Page<FoodOrderSummaryResult>> {
    const result = await this.orders.find(
      { consumerUserId: userId, paidOnly: true },
      toPageRequest(page),
    );
    return {
      items: await this.views.summaries(result.items, 'CONSUMER'),
      total: result.total,
      page: page.page,
      size: page.size,
    };
  }

  async detail(
    userId: string,
    orderId: string,
  ): Promise<FoodOrderDetailResult> {
    return this.views.detail(
      await this.access.ofConsumer(userId, orderId),
      'CONSUMER',
    );
  }

  /** 라이더 위치와 도착 예정 시각. 가게가 받아 배달을 요청한 뒤부터 볼 수 있다. */
  async track(userId: string, orderId: string): Promise<TrackingResult> {
    const order = await this.access.ofConsumer(userId, orderId);
    if (!order.deliveryOrderId) {
      throw new ConflictError(
        'DELIVERY_NOT_REQUESTED',
        '가게가 주문을 받으면 배달 상황을 볼 수 있어요.',
      );
    }
    return this.deliveries.track(order.deliveryOrderId);
  }

  /** 가게가 받기 전까지 취소할 수 있다. 결제했으면 모두 돌려준다. */
  async cancel(
    userId: string,
    orderId: string,
    reason: string,
  ): Promise<FoodOrderDetailResult> {
    const order = await this.access.ofConsumer(userId, orderId);
    order.cancel(FoodOrderCanceller.CONSUMER, reason, randomUUID(), new Date());
    await this.orders.save(order);
    await this.eventPublisher.publishAll(order.pullDomainEvents());
    await this.refunds.settle(order);
    return this.views.detail(order, 'CONSUMER');
  }

  /** 배달이 끝난 주문에 별점과 글을 남긴다. 주문 하나에 한 번. */
  async review(
    userId: string,
    orderId: string,
    input: { rating: number; content?: string | null },
  ): Promise<ReviewResult> {
    const order = await this.access.ofConsumer(userId, orderId);
    const policy = await this.policy.current();
    const now = new Date();
    order.assertReviewable(userId, policy.reviewWindowDays, now);
    if (await this.reviews.findByFoodOrder(order.id)) {
      throw new ConflictError('ALREADY_REVIEWED', '이미 리뷰를 쓴 주문이에요.');
    }
    const consumer = await this.users.findById(userId);
    const review = writeReview({
      id: randomUUID(),
      foodOrderId: order.id,
      storeId: order.storeId,
      consumerUserId: userId,
      consumerName: consumer?.name ?? '손님',
      orderSummary: order.summary(),
      rating: input.rating,
      content: input.content ?? null,
      now,
    });
    await this.reviews.insert(review);
    return {
      id: review.id,
      foodOrderId: review.foodOrderId,
      authorName: review.authorName,
      rating: review.rating,
      content: review.content,
      orderSummary: review.orderSummary,
      createdAt: review.createdAt,
    };
  }
}
