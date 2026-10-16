import { InvalidArgumentError } from '../../../../common/domain/domain-error.js';
import {
  addDays,
  kstDateString,
  kstDayOfWeek,
  kstStartOfDay,
} from '../../../../common/domain/kst.js';
import {
  MarketplacePolicy,
  StoreSettlementCycle,
} from '../../../platform-policy/domain/marketplace-policy.js';
import { FoodOrderState } from '../entities/food-order.entity.js';

/** 가게 정산 내역의 종류. */
export enum StoreSettlementEntryKind {
  /** 배달이 끝난 주문의 가게 몫 */
  SALE = 'SALE',
  /** 가게가 라이더 출발 뒤 취소해 낸 배달 취소 수수료 */
  CANCELLATION_FEE = 'CANCELLATION_FEE',
  /** 가게가 떠안은 부분 환불 */
  REFUND = 'REFUND',
}

/** 가게 정산 내역 한 줄. 지우거나 고치지 않고 쌓는다. 지급하면 지급 ID가 붙는다. */
export interface StoreSettlementEntry {
  id: string;
  storeId: string;
  foodOrderId: string;
  kind: StoreSettlementEntryKind;
  /** 가게가 받는(+)·내는(−) 금액 */
  amount: number;
  /** SALE의 계산 내역. 그 밖에는 0. */
  menuAmount: number;
  deliveryTip: number;
  commission: number;
  paymentFee: number;
  deliveryFee: number;
  memo: string | null;
  /** 지급 예정일 (한국 날짜 YYYY-MM-DD) */
  payoutDueOn: string;
  payoutId: string | null;
  createdAt: Date;
}

/** 가게에 보낸 정산금 한 건. 지금은 운영자가 직접 이체하고 기록한다. */
export interface StorePayout {
  id: string;
  storeId: string;
  /** 이 날까지 지급 예정이던 내역을 모아 보냈다 */
  dueOn: string;
  amount: number;
  entryCount: number;
  bankName: string;
  maskedAccountNumber: string;
  accountHolder: string;
  paidAt: Date;
  /** 지급 처리한 운영자 (회원 ID) */
  paidBy: string;
}

/** 가게 정산 계좌. */
export interface StoreSettlementAccount {
  storeId: string;
  bankName: string;
  /** 숫자만 */
  accountNumber: string;
  accountHolder: string;
  /** 운영자가 통장 사본 등으로 확인한 시각. 계좌를 바꾸면 다시 확인한다. */
  verifiedAt: Date | null;
  verifiedBy: string | null;
  updatedAt: Date;
}

/** 운영자가 한 가게의 지급을 멈췄다 (분쟁·서류 확인 등). */
export interface StoreSettlementHold {
  storeId: string;
  reason: string;
  heldAt: Date;
  heldBy: string;
}

type SettlementSchedule = Pick<
  MarketplacePolicy,
  | 'storeSettlementCycle'
  | 'storeSettlementDelayDays'
  | 'storeSettlementPayoutWeekday'
>;

/**
 * 지급 예정일. DAILY는 그날(한국 날짜)에서 N일 뒤, WEEKLY는 그 주(월~일)의 다음 주 정한 요일.
 */
export function payoutDueOn(at: Date, schedule: SettlementSchedule): string {
  const day = kstStartOfDay(at);
  if (schedule.storeSettlementCycle === StoreSettlementCycle.DAILY) {
    return kstDateString(addDays(day, schedule.storeSettlementDelayDays));
  }
  const monday = addDays(day, -((kstDayOfWeek(at) + 6) % 7));
  const offset = (schedule.storeSettlementPayoutWeekday + 6) % 7;
  return kstDateString(addDays(monday, 7 + offset));
}

/**
 * 배달이 끝난 주문의 가게 몫.
 * 메뉴 금액 + 손님이 낸 배달팁 − 중개수수료(메뉴 금액 × 주문 당시 요율) − 결제수수료(결제 금액 × 요율)
 * − 배달대행료. 원 단위로 반올림한다.
 */
export function saleEntry(input: {
  id: string;
  order: FoodOrderState;
  deliveryFee: number;
  dueOn: string;
  now: Date;
}): StoreSettlementEntry {
  const { order } = input;
  const commission = Math.round(
    (order.menuAmount * order.commissionRatePercent) / 100,
  );
  const paymentFee = Math.round(
    (order.paymentAmount * order.paymentFeeRatePercent) / 100,
  );
  return {
    id: input.id,
    storeId: order.storeId,
    foodOrderId: order.id,
    kind: StoreSettlementEntryKind.SALE,
    amount:
      order.menuAmount +
      order.deliveryTip -
      commission -
      paymentFee -
      input.deliveryFee,
    menuAmount: order.menuAmount,
    deliveryTip: order.deliveryTip,
    commission,
    paymentFee,
    deliveryFee: input.deliveryFee,
    memo: null,
    payoutDueOn: input.dueOn,
    payoutId: null,
    createdAt: input.now,
  };
}

/** 가게가 내는 금액 한 줄 (취소 수수료·부분 환불). */
export function chargeEntry(input: {
  id: string;
  storeId: string;
  foodOrderId: string;
  kind:
    StoreSettlementEntryKind.CANCELLATION_FEE | StoreSettlementEntryKind.REFUND;
  amount: number;
  memo: string;
  dueOn: string;
  now: Date;
}): StoreSettlementEntry {
  return {
    id: input.id,
    storeId: input.storeId,
    foodOrderId: input.foodOrderId,
    kind: input.kind,
    amount: -Math.abs(input.amount),
    menuAmount: 0,
    deliveryTip: 0,
    commission: 0,
    paymentFee: 0,
    deliveryFee: 0,
    memo: input.memo,
    payoutDueOn: input.dueOn,
    payoutId: null,
    createdAt: input.now,
  };
}

/** 정산 계좌를 확인한다. */
export function settlementAccount(input: {
  storeId: string;
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  now: Date;
}): StoreSettlementAccount {
  const bankName = input.bankName.trim();
  const accountNumber = input.accountNumber.replace(/[\s-]/g, '');
  const accountHolder = input.accountHolder.trim();
  if (!bankName || bankName.length > 20) {
    throw new InvalidArgumentError(
      'INVALID_SETTLEMENT_ACCOUNT',
      '은행을 골라 주세요.',
    );
  }
  if (!/^\d{10,16}$/.test(accountNumber)) {
    throw new InvalidArgumentError(
      'INVALID_SETTLEMENT_ACCOUNT',
      '계좌번호는 숫자 10~16자리예요.',
    );
  }
  if (!accountHolder || accountHolder.length > 30) {
    throw new InvalidArgumentError(
      'INVALID_SETTLEMENT_ACCOUNT',
      '예금주를 적어 주세요.',
    );
  }
  return {
    storeId: input.storeId,
    bankName,
    accountNumber,
    accountHolder,
    verifiedAt: null,
    verifiedBy: null,
    updatedAt: input.now,
  };
}

/** 계좌번호 끝 네 자리만 보인다 (••••1024). */
export function maskAccountNumber(accountNumber: string): string {
  return `••••${accountNumber.slice(-4)}`;
}
