import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import {
  PageQuery,
  toPageRequest,
} from '../../../../common/application/page.js';
import {
  ConflictError,
  InvalidArgumentError,
  NotFoundError,
} from '../../../../common/domain/domain-error.js';
import { kstDateString, parseKstDate } from '../../../../common/domain/kst.js';
import {
  STORE_REPOSITORY,
  type StoreRepository,
} from '../../../store/domain/store.repository.js';
import {
  STORE_SETTLEMENT_REPOSITORY,
  type StoreSettlementRepository,
} from '../../domain/repositories/marketplace.repositories.js';
import { maskAccountNumber } from '../../domain/services/store-settlement.js';
import {
  DueStoreSettlementResult,
  Page,
  StorePayoutResult,
  StoreSettlementAccountResult,
  StoreSettlementEntryResult,
} from '../dto/marketplace.result.js';
import {
  accountResult,
  entryResult,
  payoutResult,
} from '../services/settlement-views.js';

/**
 * 운영자의 가게 정산: 지급할 정산(가게별), 계좌 확인, 지급 보류, 지급 처리, 지급 내역.
 * 지금은 운영자가 직접 이체하고 기록한다. PG 지급대행을 붙이면 지급 처리에서 그 API를 부른다.
 */
@Injectable()
export class AdminStoreSettlementsUseCase {
  constructor(
    @Inject(STORE_SETTLEMENT_REPOSITORY)
    private readonly settlements: StoreSettlementRepository,
    @Inject(STORE_REPOSITORY)
    private readonly stores: StoreRepository,
  ) {}

  /** [asOf](한국 날짜, 기본 오늘)까지 지급 예정인데 아직 보내지 않은 정산. */
  async due(
    asOf?: string,
  ): Promise<{ asOf: string; items: DueStoreSettlementResult[] }> {
    const date = this.date(asOf);
    const rows = await this.settlements.due(date);
    const storeIds = rows.map((row) => row.storeId);
    const [accounts, holds] = await Promise.all([
      this.settlements.findAccounts(storeIds),
      this.settlements.findHolds(storeIds),
    ]);
    return {
      asOf: date,
      items: rows.map((row) => {
        const account = accountResult(accounts.get(row.storeId));
        const holdReason = holds.get(row.storeId)?.reason ?? null;
        return {
          ...row,
          account,
          holdReason,
          payable: row.amount > 0 && !holdReason && account?.verified === true,
        };
      }),
    };
  }

  /** 가게 하나의 [asOf]까지 지급 예정 정산을 보냈다고 기록한다. */
  async pay(
    adminId: string,
    storeId: string,
    asOf?: string,
  ): Promise<StorePayoutResult> {
    const date = this.date(asOf);
    const row = (await this.settlements.due(date)).find(
      (each) => each.storeId === storeId,
    );
    if (!row || row.amount <= 0) {
      throw new ConflictError(
        'NOTHING_TO_PAY',
        '보낼 정산이 없어요. 빼야 할 금액이 더 크면 다음 정산으로 넘어가요.',
      );
    }
    if ((await this.settlements.findHolds([storeId])).has(storeId)) {
      throw new ConflictError('SETTLEMENT_ON_HOLD', '지급을 보류한 가게예요.');
    }
    const account = await this.settlements.findAccount(storeId);
    if (!account?.verifiedAt) {
      throw new ConflictError(
        'SETTLEMENT_ACCOUNT_NOT_VERIFIED',
        '정산 계좌를 먼저 확인해 주세요.',
      );
    }
    const payout = await this.settlements.pay(
      {
        id: randomUUID(),
        storeId,
        dueOn: date,
        bankName: account.bankName,
        maskedAccountNumber: maskAccountNumber(account.accountNumber),
        accountHolder: account.accountHolder,
        paidAt: new Date(),
        paidBy: adminId,
      },
      date,
    );
    return payoutResult(payout, row.storeName);
  }

  async payouts(
    filter: { storeId?: string },
    page: PageQuery,
  ): Promise<Page<StorePayoutResult>> {
    const result = await this.settlements.findPayouts(
      filter,
      toPageRequest(page),
    );
    const names = new Map<string, string>();
    for (const storeId of new Set(
      result.items.map((payout) => payout.storeId),
    )) {
      const store = await this.stores.findById(storeId);
      if (store) names.set(storeId, store.snapshot().name);
    }
    return {
      items: result.items.map((payout) =>
        payoutResult(payout, names.get(payout.storeId) ?? null),
      ),
      total: result.total,
      page: page.page,
      size: page.size,
    };
  }

  async entries(
    storeId: string,
    page: PageQuery,
  ): Promise<Page<StoreSettlementEntryResult>> {
    const result = await this.settlements.findEntries(
      storeId,
      {},
      toPageRequest(page),
    );
    return {
      items: result.items.map(entryResult),
      total: result.total,
      page: page.page,
      size: page.size,
    };
  }

  /** 정산 계좌 (전체 번호 포함 — 운영자가 이체할 때 쓴다). */
  async account(
    storeId: string,
  ): Promise<
    (StoreSettlementAccountResult & { accountNumber: string }) | null
  > {
    const account = await this.settlements.findAccount(storeId);
    return account
      ? { ...accountResult(account)!, accountNumber: account.accountNumber }
      : null;
  }

  /** 통장 사본 등으로 계좌를 확인했다. */
  async verifyAccount(
    adminId: string,
    storeId: string,
  ): Promise<StoreSettlementAccountResult> {
    const account = await this.settlements.findAccount(storeId);
    if (!account) {
      throw new NotFoundError(
        'SETTLEMENT_ACCOUNT_NOT_FOUND',
        '등록한 정산 계좌가 없어요.',
      );
    }
    const verified = {
      ...account,
      verifiedAt: new Date(),
      verifiedBy: adminId,
    };
    await this.settlements.saveAccount(verified);
    return accountResult(verified)!;
  }

  /** 지급 보류 (사유 필수). reason이 null이면 보류를 푼다. */
  async hold(
    adminId: string,
    storeId: string,
    reason: string | null,
  ): Promise<void> {
    if (!(await this.stores.findById(storeId))) {
      throw new NotFoundError('STORE_NOT_FOUND', '가게를 찾을 수 없어요.');
    }
    if (reason === null) {
      await this.settlements.deleteHold(storeId);
      return;
    }
    const trimmed = reason.trim();
    if (!trimmed || trimmed.length > 200) {
      throw new InvalidArgumentError(
        'HOLD_REASON_REQUIRED',
        '보류 사유를 200자 안으로 적어 주세요.',
      );
    }
    await this.settlements.saveHold({
      storeId,
      reason: trimmed,
      heldAt: new Date(),
      heldBy: adminId,
    });
  }

  private date(asOf?: string): string {
    if (!asOf) return kstDateString(new Date());
    if (!parseKstDate(asOf)) {
      throw new InvalidArgumentError(
        'INVALID_DATE',
        '날짜는 YYYY-MM-DD로 적어 주세요.',
      );
    }
    return asOf;
  }
}
