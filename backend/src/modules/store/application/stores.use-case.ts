import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { PageQuery, toPageRequest } from '../../../common/application/page.js';
import {
  ConflictError,
  NotFoundError,
  UnavailableError,
} from '../../../common/domain/domain-error.js';
import { Store, StoreProfile } from '../domain/store.entity.js';
import {
  STORE_REPOSITORY,
  type StoreRepository,
} from '../domain/store.repository.js';
import {
  StoreResult,
  toStoreResult,
  toWalletEntryResult,
  WalletEntryResult,
  WalletResult,
} from './store.result.js';
import { TOP_UP_POLICY, type TopUpPolicy } from './top-up.port.js';

/**
 * 가게 유스케이스 (사장님). 가게를 등록하면 운영자 심사를 기다린다.
 * 배달대행료는 충전금에서 빠지므로 먼저 충전해 둔다.
 */
@Injectable()
export class StoresUseCase {
  constructor(
    @Inject(STORE_REPOSITORY)
    private readonly stores: StoreRepository,
    @Inject(TOP_UP_POLICY)
    private readonly topUpPolicy: TopUpPolicy,
  ) {}

  async register(userId: string, profile: StoreProfile): Promise<StoreResult> {
    if (await this.stores.findByOwner(userId)) {
      throw new ConflictError(
        'STORE_ALREADY_REGISTERED',
        '이미 가게를 등록했어요.',
      );
    }
    const store = Store.register({
      id: randomUUID(),
      ownerUserId: userId,
      profile,
      now: new Date(),
    });
    await this.stores.save(store);
    return toStoreResult(store);
  }

  async mine(userId: string): Promise<StoreResult> {
    return toStoreResult(await this.requireMine(userId));
  }

  async update(userId: string, profile: StoreProfile): Promise<StoreResult> {
    const store = await this.requireMine(userId);
    store.updateProfile(profile, new Date());
    await this.stores.save(store);
    return toStoreResult(store);
  }

  async wallet(userId: string, page: PageQuery): Promise<WalletResult> {
    const store = await this.requireMine(userId);
    const { items, total } = await this.stores.findEntries(
      store.id,
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

  /** 충전. 지금은 개발 서버에서만 바로 충전된다 — 실제 충전은 포트원 가상계좌를 붙인 뒤. */
  async topUp(userId: string, amount: number): Promise<WalletEntryResult> {
    if (!this.topUpPolicy.instant) {
      throw new UnavailableError(
        'TOP_UP_NOT_READY',
        '충전은 준비 중이에요. 고객센터로 문의해 주세요.',
      );
    }
    const store = await this.requireMine(userId);
    const entry = store.topUp({
      entryId: randomUUID(),
      amount,
      now: new Date(),
    });
    await this.stores.save(store);
    return toWalletEntryResult(entry);
  }

  private async requireMine(userId: string): Promise<Store> {
    const store = await this.stores.findByOwner(userId);
    if (!store) {
      throw new NotFoundError(
        'STORE_NOT_REGISTERED',
        '가게를 먼저 등록해 주세요.',
      );
    }
    return store;
  }
}
