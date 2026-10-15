import { Paged, PageRequest } from '../../../../common/domain/pagination.js';
import { Payout } from '../entities/payout.entity.js';

/** 지급 기록 저장소 DI 토큰. */
export const PAYOUT_REPOSITORY = Symbol('PAYOUT_REPOSITORY');

/** 지급 기록 저장소 계약. */
export interface PayoutRepository {
  /**
   * 새 지급들을 한꺼번에 저장한다. 이미 지급했거나 지급 중인 기사·주가 섞여 있으면
   * 하나도 저장하지 않고 ConflictError.
   */
  saveAll(payouts: Payout[]): Promise<void>;
  /** 지급 결과(상태)를 저장한다. */
  update(payout: Payout): Promise<void>;
  /** 그 주의 지급 기록 전부 (실패 포함, 처리한 순서). */
  findByWeek(weekStart: Date): Promise<Payout[]>;
  /** 기사의 지급 기록 (최근 주부터). */
  findByDriver(driverId: string, limit: number): Promise<Payout[]>;
  /** 최근에 처리한 것부터. */
  findPage(page: PageRequest): Promise<Paged<Payout>>;
}
