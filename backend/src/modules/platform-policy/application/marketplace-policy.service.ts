import { Inject, Injectable } from '@nestjs/common';
import {
  DEFAULT_MARKETPLACE_POLICY,
  MarketplacePolicy,
  normalizeMarketplacePolicy,
} from '../domain/marketplace-policy.js';
import {
  POLICY_REPOSITORY,
  type PolicyChange,
  type PolicyRepository,
} from '../domain/policy.repository.js';

/** 운영자 화면에 보이는 정책과 바꾼 사람·시각. */
export interface MarketplacePolicyResult extends MarketplacePolicy {
  /** 한 번도 바꾸지 않았으면 null (처음 값) */
  updatedAt: Date | null;
  updatedBy: string | null;
}

/**
 * 주문앱 정책을 읽고 바꾼다. 다른 컨텍스트(가입·주문·정산)는 [current]로 지금 값을 읽는다.
 * 요청마다 DB에서 읽는다 — 운영자가 바꾸면 바로 적용된다.
 */
@Injectable()
export class MarketplacePolicyService {
  constructor(
    @Inject(POLICY_REPOSITORY)
    private readonly repository: PolicyRepository,
  ) {}

  async current(): Promise<MarketplacePolicy> {
    const stored = await this.repository.findMarketplace();
    return normalizeMarketplacePolicy(
      stored?.value ?? DEFAULT_MARKETPLACE_POLICY,
    );
  }

  async get(): Promise<MarketplacePolicyResult> {
    const stored = await this.repository.findMarketplace();
    return {
      ...normalizeMarketplacePolicy(
        stored?.value ?? DEFAULT_MARKETPLACE_POLICY,
      ),
      updatedAt: stored?.updatedAt ?? null,
      updatedBy: stored?.updatedBy ?? null,
    };
  }

  /** 준 칸만 바꾼다. 나머지는 지금 값을 그대로 둔다. */
  async update(
    adminId: string,
    changes: Partial<MarketplacePolicy>,
  ): Promise<MarketplacePolicyResult> {
    // 요청 DTO에는 주지 않은 칸도 undefined로 들어 있다 — 지금 값을 덮지 않게 뺀다.
    const given = Object.fromEntries(
      Object.entries(changes).filter(([, value]) => value !== undefined),
    );
    const next = normalizeMarketplacePolicy({
      ...(await this.current()),
      ...given,
    });
    await this.repository.saveMarketplace(next, adminId, new Date());
    return this.get();
  }

  history(limit = 50): Promise<PolicyChange<MarketplacePolicy>[]> {
    return this.repository.marketplaceHistory(limit);
  }
}
