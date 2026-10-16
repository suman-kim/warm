import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { PageQuery, toPageRequest } from '../../../common/application/page.js';
import { NotFoundError } from '../../../common/domain/domain-error.js';
import { kstStartOfDay } from '../../../common/domain/kst.js';
import {
  USER_REPOSITORY,
  type UserRepository,
} from '../../user/domain/repositories/user.repository.js';
import {
  LOW_WALLET_BALANCE,
  Store,
  StoreStatus,
} from '../domain/store.entity.js';
import {
  STORE_REPOSITORY,
  type StoreRepository,
} from '../domain/store.repository.js';
import {
  AdminStorePageResult,
  AdminStoreResult,
  toStoreResult,
  toWalletEntryResult,
  WalletEntryResult,
  StoreWalletOverviewResult,
  WalletResult,
} from './store.result.js';

/** 가게 심사와 충전금 조정 (운영자). */
@Injectable()
export class AdminStoresUseCase {
  constructor(
    @Inject(STORE_REPOSITORY)
    private readonly stores: StoreRepository,
    @Inject(USER_REPOSITORY)
    private readonly users: UserRepository,
  ) {}

  async list(
    filter: { status?: StoreStatus; q?: string },
    page: PageQuery,
  ): Promise<AdminStorePageResult> {
    const [{ items, total }, counts] = await Promise.all([
      this.stores.findAll(filter, toPageRequest(page)),
      this.stores.countByStatus(),
    ]);
    return {
      items: await this.withOwners(items),
      counts,
      total,
      page: page.page,
      size: page.size,
    };
  }

  async detail(id: string): Promise<AdminStoreResult> {
    const [result] = await this.withOwners([await this.require(id)]);
    return result;
  }

  async approve(id: string, adminId: string): Promise<AdminStoreResult> {
    const store = await this.require(id);
    store.approve(adminId, new Date());
    await this.stores.save(store);
    return this.detail(id);
  }

  async reject(
    id: string,
    reason: string,
    adminId: string,
  ): Promise<AdminStoreResult> {
    const store = await this.require(id);
    store.reject(reason, adminId, new Date());
    await this.stores.save(store);
    return this.detail(id);
  }

  /** 승인된 가게들의 충전금 현황: 합계, 잔액 부족 가게 수, 오늘 충전·대행료. */
  async walletOverview(now = new Date()): Promise<StoreWalletOverviewResult> {
    const rows = await this.stores.walletOverview(kstStartOfDay(now));
    const items = rows.map((row) => ({
      storeId: row.storeId,
      name: row.name,
      balance: row.balance,
      todayTopUps: row.topUpsSince,
      todayFees: row.feesSince,
      lastEntryKind: row.lastEntryKind,
      lastEntryAt: row.lastEntryAt,
      low: row.balance < LOW_WALLET_BALANCE,
    }));
    return {
      totalBalance: items.reduce((sum, item) => sum + item.balance, 0),
      lowBalanceCount: items.filter((item) => item.low).length,
      todayTopUps: items.reduce((sum, item) => sum + item.todayTopUps, 0),
      items,
    };
  }

  async wallet(id: string, page: PageQuery): Promise<WalletResult> {
    const store = await this.require(id);
    const { items, total } = await this.stores.findEntries(
      id,
      toPageRequest(page),
    );
    return {
      balance: store.walletBalance,
      items: items.map(toWalletEntryResult),
      total,
      page: page.page,
      size: page.size,
    };
  }

  /** 충전금 조정 (+ 늘리기, - 줄이기). 누가 왜 했는지 내역에 남는다. */
  async adjust(
    id: string,
    input: { amount: number; memo: string },
    adminId: string,
  ): Promise<WalletEntryResult> {
    const store = await this.require(id);
    const entry = store.adjust({
      entryId: randomUUID(),
      amount: input.amount,
      memo: input.memo,
      adminId,
      now: new Date(),
    });
    await this.stores.save(store);
    return toWalletEntryResult(entry);
  }

  private async require(id: string): Promise<Store> {
    const store = await this.stores.findById(id);
    if (!store) {
      throw new NotFoundError('STORE_NOT_FOUND', '가게를 찾을 수 없어요.');
    }
    return store;
  }

  private async withOwners(stores: Store[]): Promise<AdminStoreResult[]> {
    const owners = await this.users.findByIds(
      stores.map((store) => store.ownerUserId),
    );
    const byId = new Map(owners.map((user) => [user.id, user]));
    return stores.map((store) => {
      // 탈퇴한 사장님은 이름·이메일이 지워져 있다.
      const owner = byId.get(store.ownerUserId);
      const present = owner && owner.snapshot().withdrawnAt === null;
      return {
        ...toStoreResult(store),
        ownerUserId: store.ownerUserId,
        ownerName: present ? owner.name : null,
        ownerEmail: present ? owner.email : null,
      };
    });
  }
}
