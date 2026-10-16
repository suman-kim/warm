import { InvalidArgumentError } from '../../../../common/domain/domain-error.js';

/** 손님이 배달이 끝난 주문에 남긴 리뷰. 주문 하나에 하나. */
export interface Review {
  id: string;
  foodOrderId: string;
  storeId: string;
  consumerUserId: string;
  /** 다른 손님에게 보이는 이름 (가운데를 가린다: 김*은) */
  authorName: string;
  rating: number;
  content: string | null;
  /** 시킨 메뉴 요약 (후라이드 치킨 외 1개) */
  orderSummary: string;
  createdAt: Date;
}

export function writeReview(input: {
  id: string;
  foodOrderId: string;
  storeId: string;
  consumerUserId: string;
  consumerName: string;
  orderSummary: string;
  rating: number;
  content: string | null;
  now: Date;
}): Review {
  if (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5) {
    throw new InvalidArgumentError(
      'INVALID_RATING',
      '별점은 1점부터 5점까지예요.',
    );
  }
  const content = input.content?.trim() || null;
  if (content && content.length > 500) {
    throw new InvalidArgumentError(
      'REVIEW_TOO_LONG',
      '리뷰는 500자까지 쓸 수 있어요.',
    );
  }
  return {
    id: input.id,
    foodOrderId: input.foodOrderId,
    storeId: input.storeId,
    consumerUserId: input.consumerUserId,
    authorName: maskName(input.consumerName),
    rating: input.rating,
    content,
    orderSummary: input.orderSummary,
    createdAt: input.now,
  };
}

/** 이름 가운데를 가린다: 김지은 → 김*은, 이준 → 이*, 남궁민수 → 남**수. */
export function maskName(name: string): string {
  const chars = [...name.trim()];
  if (chars.length <= 1) return chars.join('') || '손님';
  if (chars.length === 2) return `${chars[0]}*`;
  return `${chars[0]}${'*'.repeat(chars.length - 2)}${chars.at(-1)}`;
}
