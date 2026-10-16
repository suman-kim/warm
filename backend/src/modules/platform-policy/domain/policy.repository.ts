import { MarketplacePolicy } from './marketplace-policy.js';

/** 정책 저장소 DI 토큰. */
export const POLICY_REPOSITORY = Symbol('POLICY_REPOSITORY');

/** 저장된 정책과, 누가 언제 바꿨는지. */
export interface StoredPolicy<T> {
  value: T;
  updatedAt: Date;
  /** 바꾼 운영자 (회원 ID) */
  updatedBy: string | null;
}

/** 바꾼 기록 한 줄. */
export interface PolicyChange<T> {
  id: string;
  value: T;
  changedAt: Date;
  changedBy: string;
}

export interface PolicyRepository {
  /** 한 번도 저장하지 않았으면 null — 처음 값을 쓴다. */
  findMarketplace(): Promise<StoredPolicy<Partial<MarketplacePolicy>> | null>;
  /** 정책을 바꾸고 바꾼 기록을 남긴다. */
  saveMarketplace(
    policy: MarketplacePolicy,
    adminId: string,
    now: Date,
  ): Promise<void>;
  /** 바꾼 기록 (최근 것부터). */
  marketplaceHistory(limit: number): Promise<PolicyChange<MarketplacePolicy>[]>;
}
