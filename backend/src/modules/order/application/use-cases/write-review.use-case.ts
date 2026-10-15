import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { NotFoundError } from '../../../../common/domain/domain-error.js';
import { Review, ReviewTag } from '../../domain/entities/review.entity.js';
import {
  ORDER_REPOSITORY,
  type OrderRepository,
} from '../../domain/repositories/order.repository.js';
import {
  REVIEW_REPOSITORY,
  type ReviewRepository,
} from '../../domain/repositories/review.repository.js';
import { ReviewResult, toReviewResult } from '../dto/order.result.js';

export interface WriteReviewCommand {
  rating: number;
  tags?: ReviewTag[];
  comment?: string | null;
}

/** 평가 남기기 유스케이스 (고객). 배송이 완료된 내 주문에 한 번만 남길 수 있다. */
@Injectable()
export class WriteReviewUseCase {
  constructor(
    @Inject(ORDER_REPOSITORY)
    private readonly orderRepository: OrderRepository,
    @Inject(REVIEW_REPOSITORY)
    private readonly reviewRepository: ReviewRepository,
  ) {}

  async execute(
    customerId: string,
    orderId: string,
    command: WriteReviewCommand,
  ): Promise<ReviewResult> {
    const order = await this.orderRepository.findById(orderId);
    if (!order) {
      throw new NotFoundError('ORDER_NOT_FOUND', '주문을 찾을 수 없어요.');
    }
    const review = Review.write({
      id: randomUUID(),
      order,
      customerId,
      ...command,
      now: new Date(),
    });
    await this.reviewRepository.save(review);
    return toReviewResult(review);
  }
}
