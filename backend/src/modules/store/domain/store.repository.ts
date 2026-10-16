import { Paged, PageRequest } from '../../../common/domain/pagination.js';
import {
  Store,
  StoreStatus,
  WalletEntry,
  WalletEntryKind,
} from './store.entity.js';

/** 가게 저장소 DI 토큰. */
export const STORE_REPOSITORY = Symbol('STORE_REPOSITORY');

/** 승인된 가게 하나의 충전금 현황. */
export interface StoreWalletRow {
  storeId: string;
  name: string;
  balance: number;
  /** 기준 시각 이후 충전한 금액 합 */
  topUpsSince: number;
  /** 기준 시각 이후 대행료로 나간 금액 합 (취소로 돌려받은 것은 뺀다) */
  feesSince: number;
  lastEntryKind: WalletEntryKind | null;
  lastEntryAt: Date | null;
}

/** 가게 저장소 계약. 저장하면 새로 생긴 충전금 내역도 함께 남긴다. */
export interface StoreRepository {
  save(store: Store): Promise<void>;
  findById(id: string): Promise<Store | null>;
  findByOwner(ownerUserId: string): Promise<Store | null>;
  /** 심사 대기는 먼저 신청한 순서, 그 밖에는 최근에 신청한 순서. */
  findAll(
    filter: { status?: StoreStatus; q?: string },
    page: PageRequest,
  ): Promise<Paged<Store>>;
  /** 심사 상태별 가게 수 */
  countByStatus(): Promise<Record<StoreStatus, number>>;
  /** 충전금 내역 (최근 것부터). */
  findEntries(storeId: string, page: PageRequest): Promise<Paged<WalletEntry>>;
  /** 승인된 가게들의 충전금 현황. 잔액이 적은 가게부터. */
  walletOverview(since: Date): Promise<StoreWalletRow[]>;
}
