import { Inject, Injectable } from '@nestjs/common';
import {
  PageQuery,
  toPageRequest,
} from '../../../../common/application/page.js';
import { addDays, parseKstDate } from '../../../../common/domain/kst.js';
import { MarketplacePolicyService } from '../../../platform-policy/application/marketplace-policy.service.js';
import {
  STORE_SETTLEMENT_REPOSITORY,
  type StoreSettlementRepository,
} from '../../domain/repositories/marketplace.repositories.js';
import { settlementAccount } from '../../domain/services/store-settlement.js';
import {
  Page,
  StorePayoutResult,
  StoreSettlementAccountResult,
  StoreSettlementEntryResult,
  StoreSettlementSummaryResult,
} from '../dto/marketplace.result.js';
import { OwnedStore } from '../services/owned-store.js';
import {
  accountResult,
  entryResult,
  payoutResult,
} from '../services/settlement-views.js';

/** 사장님의 매출·정산: 지급 예정, 주문별 정산 내역, 지급 내역, 정산 계좌. */
@Injectable()
export class StoreSettlementsUseCase {
  constructor(
    private readonly owned: OwnedStore,
    private readonly policy: MarketplacePolicyService,
    @Inject(STORE_SETTLEMENT_REPOSITORY)
    private readonly settlements: StoreSettlementRepository,
  ) {}

  async summary(ownerUserId: string): Promise<StoreSettlementSummaryResult> {
    const store = await this.owned.store(ownerUserId);
    const [upcoming, policy, holds] = await Promise.all([
      this.settlements.unpaidByDueOn(store.id),
      this.policy.current(),
      this.settlements.findHolds([store.id]),
    ]);
    return {
      upcoming,
      upcomingTotal: upcoming.reduce((sum, row) => sum + row.amount, 0),
      cycle: policy.storeSettlementCycle,
      payoutWeekday: policy.storeSettlementPayoutWeekday,
      delayDays: policy.storeSettlementDelayDays,
      commissionRatePercent: policy.commissionRatePercent,
      paymentFeeRatePercent: policy.paymentFeeRatePercent,
      holdReason: holds.get(store.id)?.reason ?? null,
    };
  }

  /** 정산 내역 (최근 것부터). from·to는 한국 날짜이고 to도 포함한다. */
  async entries(
    ownerUserId: string,
    filter: { from?: string; to?: string },
    page: PageQuery,
  ): Promise<Page<StoreSettlementEntryResult>> {
    const store = await this.owned.store(ownerUserId);
    const from = filter.from ? parseKstDate(filter.from) : null;
    const to = filter.to ? parseKstDate(filter.to) : null;
    const result = await this.settlements.findEntries(
      store.id,
      { from: from ?? undefined, to: to ? addDays(to, 1) : undefined },
      toPageRequest(page),
    );
    return {
      items: result.items.map(entryResult),
      total: result.total,
      page: page.page,
      size: page.size,
    };
  }

  async payouts(
    ownerUserId: string,
    page: PageQuery,
  ): Promise<Page<StorePayoutResult>> {
    const store = await this.owned.store(ownerUserId);
    const result = await this.settlements.findPayouts(
      { storeId: store.id },
      toPageRequest(page),
    );
    return {
      items: result.items.map((payout) =>
        payoutResult(payout, store.snapshot().name),
      ),
      total: result.total,
      page: page.page,
      size: page.size,
    };
  }

  async account(
    ownerUserId: string,
  ): Promise<StoreSettlementAccountResult | null> {
    const store = await this.owned.store(ownerUserId);
    return accountResult(await this.settlements.findAccount(store.id));
  }

  /** 정산 계좌 등록·변경. 바꾸면 운영자가 다시 확인해야 지급된다. */
  async saveAccount(
    ownerUserId: string,
    input: { bankName: string; accountNumber: string; accountHolder: string },
  ): Promise<StoreSettlementAccountResult> {
    const store = await this.owned.store(ownerUserId);
    const account = settlementAccount({
      storeId: store.id,
      ...input,
      now: new Date(),
    });
    const current = await this.settlements.findAccount(store.id);
    const unchanged =
      current &&
      current.bankName === account.bankName &&
      current.accountNumber === account.accountNumber &&
      current.accountHolder === account.accountHolder;
    const saved = unchanged
      ? {
          ...account,
          verifiedAt: current.verifiedAt,
          verifiedBy: current.verifiedBy,
        }
      : account;
    await this.settlements.saveAccount(saved);
    return accountResult(saved)!;
  }
}
