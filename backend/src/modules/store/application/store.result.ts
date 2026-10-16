import {
  Store,
  StoreStatus,
  WalletEntry,
  WalletEntryKind,
} from '../domain/store.entity.js';

/** 가게 주소 (픽업지) */
export class StoreAddressResult {
  address: string;
  detailAddress: string | null;
  sigungu: string;
  dong: string;
  latitude: number;
  longitude: number;
}

/** 내 가게 */
export class StoreResult {
  id: string;
  name: string;
  /** 사업자등록번호 (숫자 10자리) */
  businessNumber: string;
  phone: string;
  address: StoreAddressResult;
  status: StoreStatus;
  /** 반려됐을 때 사유 */
  rejectionReason: string | null;
  /** 충전금 잔액 (원) */
  walletBalance: number;
  appliedAt: Date;
  reviewedAt: Date | null;
}

/** 운영자가 보는 가게 — 사장님 정보가 붙는다. */
export class AdminStoreResult extends StoreResult {
  ownerUserId: string;
  /** 탈퇴했으면 null */
  ownerName: string | null;
  ownerEmail: string | null;
}

export class AdminStorePageResult {
  items: AdminStoreResult[];
  /** 심사 상태별 가게 수 (탭에 붙는 숫자) */
  counts: Record<StoreStatus, number>;
  total: number;
  page: number;
  size: number;
}

/** 충전금 내역 한 줄 */
export class WalletEntryResult {
  id: string;
  kind: WalletEntryKind;
  /** 늘면 +, 줄면 - (원) */
  amount: number;
  balanceAfter: number;
  orderId: string | null;
  memo: string | null;
  createdAt: Date;
}

/** 충전금 잔액과 내역 (최근 것부터) */
export class WalletResult {
  balance: number;
  items: WalletEntryResult[];
  total: number;
  page: number;
  size: number;
}

export function toStoreResult(store: Store): StoreResult {
  const s = store.snapshot();
  return {
    id: s.id,
    name: s.name,
    businessNumber: s.businessNumber,
    phone: s.phone,
    address: { ...s.address },
    status: s.status,
    rejectionReason: s.rejectionReason,
    walletBalance: s.walletBalance,
    appliedAt: s.appliedAt,
    reviewedAt: s.reviewedAt,
  };
}

export function toWalletEntryResult(entry: WalletEntry): WalletEntryResult {
  return {
    id: entry.id,
    kind: entry.kind,
    amount: entry.amount,
    balanceAfter: entry.balanceAfter,
    orderId: entry.orderId,
    memo: entry.memo,
    createdAt: entry.createdAt,
  };
}

/** 가게 충전금 현황의 한 줄 (운영자). */
export class StoreWalletOverviewItemResult {
  storeId: string;
  name: string;
  balance: number;
  /** 오늘(한국 날짜) 충전한 금액 */
  todayTopUps: number;
  /** 오늘 대행료로 나간 금액 (취소로 돌려받은 것은 뺀다) */
  todayFees: number;
  /** 마지막 충전금 내역의 종류와 시각. 없으면 null. */
  lastEntryKind: WalletEntryKind | null;
  lastEntryAt: Date | null;
  /** 잔액이 부족 기준(10,000원)보다 적은지 */
  low: boolean;
}

/** 가게 충전금 현황 (운영자). */
export class StoreWalletOverviewResult {
  /** 승인된 가게 충전금 합 */
  totalBalance: number;
  /** 잔액이 부족한 가게 수 */
  lowBalanceCount: number;
  /** 오늘 충전한 금액 합 */
  todayTopUps: number;
  /** 잔액이 적은 가게부터 */
  items: StoreWalletOverviewItemResult[];
}
