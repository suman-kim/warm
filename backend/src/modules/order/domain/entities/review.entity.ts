import {
  ConflictError,
  InvalidArgumentError,
  NotFoundError,
} from '../../../../common/domain/domain-error.js';
import { OrderStatus } from '../order-status.js';
import { Order } from './order.entity.js';

/** 평가할 때 고르는 칭찬 태그. */
export enum ReviewTag {
  /** 친절해요 */
  KIND = 'KIND',
  /** 빨라요 */
  FAST = 'FAST',
  /** 꼼꼼해요 */
  CAREFUL = 'CAREFUL',
}

const MAX_COMMENT_LENGTH = 300;

/** 배송이 끝난 뒤 고객이 기사에게 남기는 평가. 주문 하나에 하나다. */
export class Review {
  constructor(
    readonly id: string,
    readonly orderId: string,
    readonly customerId: string,
    readonly driverId: string,
    /** 별점 1~5 */
    readonly rating: number,
    readonly tags: ReviewTag[],
    readonly comment: string | null,
    readonly createdAt: Date,
  ) {}

  /** 주문을 요청한 고객이, 배송이 완료된 주문에만 남길 수 있다. */
  static write(input: {
    id: string;
    order: Order;
    customerId: string;
    rating: number;
    tags?: ReviewTag[];
    comment?: string | null;
    now: Date;
  }): Review {
    const { order } = input;
    if (!order.isOwnedBy(input.customerId) || !order.driverId) {
      throw new NotFoundError('ORDER_NOT_FOUND', '주문을 찾을 수 없어요.');
    }
    if (order.status !== OrderStatus.DELIVERED) {
      throw new ConflictError(
        'ORDER_NOT_DELIVERED',
        '배송이 완료된 뒤에 평가할 수 있어요.',
      );
    }
    if (
      !Number.isInteger(input.rating) ||
      input.rating < 1 ||
      input.rating > 5
    ) {
      throw new InvalidArgumentError(
        'INVALID_RATING',
        '별점은 1~5점으로 남겨주세요.',
      );
    }
    const comment = input.comment?.trim() || null;
    if (comment && comment.length > MAX_COMMENT_LENGTH) {
      throw new InvalidArgumentError(
        'REVIEW_COMMENT_TOO_LONG',
        `평가 내용은 ${MAX_COMMENT_LENGTH}자까지 쓸 수 있어요.`,
      );
    }
    return new Review(
      input.id,
      order.id,
      input.customerId,
      order.driverId,
      input.rating,
      [...new Set(input.tags ?? [])],
      comment,
      input.now,
    );
  }
}
