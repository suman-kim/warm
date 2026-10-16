import {
  maskAccountNumber,
  StorePayout,
  StoreSettlementAccount,
  StoreSettlementEntry,
} from '../../domain/services/store-settlement.js';
import {
  StorePayoutResult,
  StoreSettlementAccountResult,
  StoreSettlementEntryResult,
} from '../dto/marketplace.result.js';

export function entryResult(
  entry: StoreSettlementEntry,
): StoreSettlementEntryResult {
  return {
    id: entry.id,
    foodOrderId: entry.foodOrderId,
    kind: entry.kind,
    amount: entry.amount,
    menuAmount: entry.menuAmount,
    deliveryTip: entry.deliveryTip,
    commission: entry.commission,
    paymentFee: entry.paymentFee,
    deliveryFee: entry.deliveryFee,
    memo: entry.memo,
    payoutDueOn: entry.payoutDueOn,
    paid: entry.payoutId !== null,
    createdAt: entry.createdAt,
  };
}

export function accountResult(
  account: StoreSettlementAccount | null | undefined,
): StoreSettlementAccountResult | null {
  if (!account) return null;
  return {
    bankName: account.bankName,
    maskedAccountNumber: maskAccountNumber(account.accountNumber),
    accountHolder: account.accountHolder,
    verified: account.verifiedAt !== null,
    verifiedAt: account.verifiedAt,
    updatedAt: account.updatedAt,
  };
}

export function payoutResult(
  payout: StorePayout,
  storeName: string | null,
): StorePayoutResult {
  return {
    id: payout.id,
    storeId: payout.storeId,
    storeName,
    dueOn: payout.dueOn,
    amount: payout.amount,
    entryCount: payout.entryCount,
    bankName: payout.bankName,
    maskedAccountNumber: payout.maskedAccountNumber,
    accountHolder: payout.accountHolder,
    paidAt: payout.paidAt,
  };
}
