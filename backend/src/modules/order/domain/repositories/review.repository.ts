import { Review } from '../entities/review.entity.js';

/** 평가 저장소 DI 토큰. */
export const REVIEW_REPOSITORY = Symbol('REVIEW_REPOSITORY');

export interface DriverRating {
  /** 평균 별점 (소수 첫째 자리). 평가가 없으면 null. */
  average: number | null;
  count: number;
}

/** 평가 저장소 계약. */
export interface ReviewRepository {
  /** 주문에 이미 평가가 있으면 ConflictError(REVIEW_ALREADY_WRITTEN). */
  save(review: Review): Promise<void>;
  findByOrderId(orderId: string): Promise<Review | null>;
  ratingOf(driverId: string): Promise<DriverRating>;
}
