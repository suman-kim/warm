import { Paged, PageRequest } from '../../../../common/domain/pagination.js';
import { DriverStatus } from '../../domain/driver-status.js';
import { Driver } from '../../domain/entities/driver.entity.js';

/** 기사 심사 목록 조회 DI 토큰. */
export const DRIVER_REVIEW_QUERY = Symbol('DRIVER_REVIEW_QUERY');

export interface DriverReviewFilter {
  status?: DriverStatus;
  /** 이름, 이메일, 휴대폰 번호, 차량 번호로 찾는다 */
  q?: string;
}

/** 운영자의 기사 심사 목록 조회. 신청한 사람의 정보로도 찾아야 해서 회원과 함께 읽는다. */
export interface DriverReviewQuery {
  /** 심사 대기는 먼저 신청한 순서, 승인·반려는 최근에 처리한 순서. */
  find(filter: DriverReviewFilter, page: PageRequest): Promise<Paged<Driver>>;
  /** 상태별 건수 (탭에 보이는 숫자). */
  countByStatus(): Promise<Record<DriverStatus, number>>;
}
