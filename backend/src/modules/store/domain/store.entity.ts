import { AggregateRoot } from '../../../common/domain/aggregate-root.js';
import {
  ConflictError,
  InvalidArgumentError,
} from '../../../common/domain/domain-error.js';
import { PhoneNumber } from '../../../common/domain/phone-number.js';

/** 가게 심사 상태. */
export enum StoreStatus {
  /** 심사 대기 — 배달을 요청할 수 없다. */
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

/** 충전금 내역의 종류. */
export enum WalletEntryKind {
  /** 충전 */
  TOP_UP = 'TOP_UP',
  /** 배달대행료 차감 */
  DELIVERY_FEE = 'DELIVERY_FEE',
  /** 배달 취소로 돌려준 대행료 */
  REFUND = 'REFUND',
  /** 운영자 조정 (+/-) */
  ADJUSTMENT = 'ADJUSTMENT',
}

/** 충전금 내역 한 줄. 지우거나 고치지 않고 쌓는다. */
export interface WalletEntry {
  id: string;
  storeId: string;
  kind: WalletEntryKind;
  /** 늘면 +, 줄면 - (원) */
  amount: number;
  /** 이 내역 뒤 잔액 */
  balanceAfter: number;
  orderId: string | null;
  memo: string | null;
  /** 조정한 운영자 (회원 ID). 그 밖에는 null. */
  createdBy: string | null;
  createdAt: Date;
}

/** 가게 주소. 배달의 픽업지가 된다. */
export interface StoreAddress {
  address: string;
  detailAddress?: string | null;
  sigungu: string;
  dong: string;
  latitude: number;
  longitude: number;
}

export interface StoreProfile {
  name: string;
  businessNumber: string;
  phone: string;
  address: StoreAddress;
}

export interface StoreState extends StoreProfile {
  address: StoreAddress & { detailAddress: string | null };
  id: string;
  ownerUserId: string;
  status: StoreStatus;
  rejectionReason: string | null;
  walletBalance: number;
  appliedAt: Date;
  reviewedAt: Date | null;
  reviewedBy: string | null;
  createdAt: Date;
}

/** 한 번에 충전할 수 있는 금액 (원) */
export const TOP_UP_MIN = 10_000;
export const TOP_UP_MAX = 2_000_000;

/** 잔액이 이보다 적으면 부족으로 본다 (가게 앱 알림, 운영자 충전금 현황). */
export const LOW_WALLET_BALANCE = 10_000;

/**
 * 가게 애그리거트. 사장님 계정 하나에 가게 하나. 운영자가 승인해야 배달을 요청할 수 있다.
 * 배달대행료는 가게의 충전금에서 차감한다 — 잔액은 여기서만 바꾸고, 바꿀 때마다 내역을 남긴다.
 * 동시에 두 배달을 요청해도 낙관적 잠금(버전)으로 잔액이 꼬이지 않는다.
 */
export class Store extends AggregateRoot {
  private newEntries: WalletEntry[] = [];

  private constructor(
    private readonly state: StoreState,
    version: number,
  ) {
    super(state.id, version);
  }

  static register(input: {
    id: string;
    ownerUserId: string;
    profile: StoreProfile;
    now: Date;
  }): Store {
    return new Store(
      {
        id: input.id,
        ownerUserId: input.ownerUserId,
        ...normalizeProfile(input.profile),
        status: StoreStatus.PENDING,
        rejectionReason: null,
        walletBalance: 0,
        appliedAt: input.now,
        reviewedAt: null,
        reviewedBy: null,
        createdAt: input.now,
      },
      0,
    );
  }

  static restore(state: StoreState, version: number): Store {
    return new Store({ ...state }, version);
  }

  get status(): StoreStatus {
    return this.state.status;
  }

  get ownerUserId(): string {
    return this.state.ownerUserId;
  }

  get walletBalance(): number {
    return this.state.walletBalance;
  }

  get isApproved(): boolean {
    return this.state.status === StoreStatus.APPROVED;
  }

  snapshot(): Readonly<StoreState> {
    return { ...this.state, address: { ...this.state.address } };
  }

  /** 저장소가 저장한 뒤 꺼내 간다. */
  pullNewEntries(): WalletEntry[] {
    const entries = this.newEntries;
    this.newEntries = [];
    return entries;
  }

  /**
   * 가게 정보를 고친다. 반려된 가게가 고치면 다시 심사를 받는다.
   * 승인된 가게는 사업자등록번호를 바꿀 수 없다 (운영자에게 문의).
   */
  updateProfile(profile: StoreProfile, now: Date): void {
    const next = normalizeProfile(profile);
    if (
      this.state.status === StoreStatus.APPROVED &&
      next.businessNumber !== this.state.businessNumber
    ) {
      throw new ConflictError(
        'BUSINESS_NUMBER_LOCKED',
        '승인된 가게의 사업자등록번호는 고객센터에서 바꿀 수 있어요.',
      );
    }
    Object.assign(this.state, next);
    if (this.state.status === StoreStatus.REJECTED) {
      this.state.status = StoreStatus.PENDING;
      this.state.appliedAt = now;
    }
  }

  approve(adminId: string, now: Date): void {
    if (this.state.status !== StoreStatus.PENDING) {
      throw notPending();
    }
    this.state.status = StoreStatus.APPROVED;
    this.state.rejectionReason = null;
    this.state.reviewedAt = now;
    this.state.reviewedBy = adminId;
  }

  reject(reason: string, adminId: string, now: Date): void {
    if (this.state.status !== StoreStatus.PENDING) {
      throw notPending();
    }
    const trimmed = reason.trim();
    if (!trimmed) {
      throw new InvalidArgumentError(
        'REJECTION_REASON_REQUIRED',
        '반려 사유를 적어 주세요.',
      );
    }
    this.state.status = StoreStatus.REJECTED;
    this.state.rejectionReason = trimmed;
    this.state.reviewedAt = now;
    this.state.reviewedBy = adminId;
  }

  /** 충전. */
  topUp(input: { entryId: string; amount: number; now: Date }): WalletEntry {
    if (
      !Number.isInteger(input.amount) ||
      input.amount < TOP_UP_MIN ||
      input.amount > TOP_UP_MAX
    ) {
      throw new InvalidArgumentError(
        'INVALID_TOP_UP_AMOUNT',
        `충전은 ${TOP_UP_MIN.toLocaleString('ko-KR')}원부터 ${TOP_UP_MAX.toLocaleString('ko-KR')}원까지 할 수 있어요.`,
      );
    }
    return this.record(WalletEntryKind.TOP_UP, input.amount, input);
  }

  /** 배달대행료를 차감한다. 승인된 가게만, 잔액이 모자라면 하지 않는다. */
  chargeDeliveryFee(input: {
    entryId: string;
    orderId: string;
    amount: number;
    /** 내역에 보일 말 (손님 동 · 주문번호 끝자리) */
    memo?: string;
    now: Date;
  }): WalletEntry {
    if (!this.isApproved) {
      throw new ConflictError(
        'STORE_NOT_APPROVED',
        '가게 승인이 끝나면 배달을 요청할 수 있어요.',
      );
    }
    assertPositive(input.amount);
    if (this.state.walletBalance < input.amount) {
      throw new ConflictError(
        'INSUFFICIENT_WALLET_BALANCE',
        `충전금이 부족해요. 잔액 ${this.state.walletBalance.toLocaleString('ko-KR')}원, 대행료 ${input.amount.toLocaleString('ko-KR')}원.`,
      );
    }
    return this.record(WalletEntryKind.DELIVERY_FEE, -input.amount, input);
  }

  /** 취소된 배달의 대행료를 돌려준다. */
  refundDeliveryFee(input: {
    entryId: string;
    orderId: string;
    amount: number;
    memo: string;
    now: Date;
  }): WalletEntry {
    assertPositive(input.amount);
    return this.record(WalletEntryKind.REFUND, input.amount, input);
  }

  /** 운영자 조정. 잔액이 0원 아래로 내려가게는 할 수 없다. */
  adjust(input: {
    entryId: string;
    amount: number;
    memo: string;
    adminId: string;
    now: Date;
  }): WalletEntry {
    if (!Number.isInteger(input.amount) || input.amount === 0) {
      throw new InvalidArgumentError(
        'INVALID_ADJUSTMENT',
        '조정 금액을 적어 주세요.',
      );
    }
    if (!input.memo.trim()) {
      throw new InvalidArgumentError(
        'ADJUSTMENT_MEMO_REQUIRED',
        '조정 사유를 적어 주세요.',
      );
    }
    if (this.state.walletBalance + input.amount < 0) {
      throw new ConflictError(
        'INSUFFICIENT_WALLET_BALANCE',
        '잔액보다 많이 뺄 수 없어요.',
      );
    }
    return this.record(WalletEntryKind.ADJUSTMENT, input.amount, {
      ...input,
      memo: input.memo.trim(),
      createdBy: input.adminId,
    });
  }

  private record(
    kind: WalletEntryKind,
    amount: number,
    input: {
      entryId: string;
      now: Date;
      orderId?: string;
      memo?: string;
      createdBy?: string;
    },
  ): WalletEntry {
    this.state.walletBalance += amount;
    const entry: WalletEntry = {
      id: input.entryId,
      storeId: this.state.id,
      kind,
      amount,
      balanceAfter: this.state.walletBalance,
      orderId: input.orderId ?? null,
      memo: input.memo ?? null,
      createdBy: input.createdBy ?? null,
      createdAt: input.now,
    };
    this.newEntries.push(entry);
    return entry;
  }
}

function notPending(): ConflictError {
  return new ConflictError(
    'STORE_NOT_PENDING',
    '심사 대기 중인 가게가 아니에요.',
  );
}

function assertPositive(amount: number): void {
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new InvalidArgumentError('INVALID_AMOUNT', '금액이 올바르지 않아요.');
  }
}

function normalizeProfile(
  profile: StoreProfile,
): StoreProfile & { address: { detailAddress: string | null } } {
  const name = profile.name.trim();
  if (!name || name.length > 50) {
    throw new InvalidArgumentError(
      'INVALID_STORE_NAME',
      '가게 이름은 1~50자로 적어 주세요.',
    );
  }
  const address = profile.address;
  if (
    !address.address.trim() ||
    !address.sigungu.trim() ||
    !address.dong.trim()
  ) {
    throw new InvalidArgumentError(
      'INVALID_STORE_ADDRESS',
      '가게 주소를 검색해서 골라 주세요.',
    );
  }
  return {
    name,
    businessNumber: BusinessNumber.of(profile.businessNumber),
    phone: PhoneNumber.of(profile.phone).value,
    address: {
      address: address.address.trim(),
      detailAddress: address.detailAddress?.trim() || null,
      sigungu: address.sigungu.trim(),
      dong: address.dong.trim(),
      latitude: address.latitude,
      longitude: address.longitude,
    },
  };
}

/** 사업자등록번호 — 숫자 10자리와 국세청 검증 숫자(끝자리)를 확인한다. */
export const BusinessNumber = {
  of(raw: string): string {
    const digits = raw.replace(/[\s-]/g, '');
    if (!/^\d{10}$/.test(digits) || !BusinessNumber.isValid(digits)) {
      throw new InvalidArgumentError(
        'INVALID_BUSINESS_NUMBER',
        '사업자등록번호를 확인해 주세요.',
      );
    }
    return digits;
  },
  isValid(digits: string): boolean {
    const d = [...digits].map(Number);
    const weights = [1, 3, 7, 1, 3, 7, 1, 3, 5];
    let sum = weights.reduce((acc, w, i) => acc + w * d[i], 0);
    sum += Math.floor((d[8] * 5) / 10);
    return (10 - (sum % 10)) % 10 === d[9];
  },
};
