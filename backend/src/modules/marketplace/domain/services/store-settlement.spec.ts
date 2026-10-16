import { StoreSettlementCycle } from '../../../platform-policy/domain/marketplace-policy.js';
import { FoodOrderState } from '../entities/food-order.entity.js';
import {
  chargeEntry,
  maskAccountNumber,
  payoutDueOn,
  saleEntry,
  settlementAccount,
  StoreSettlementEntryKind,
} from './store-settlement.js';

const kst = (date: string, time = '12:00') =>
  new Date(`${date}T${time}:00+09:00`);

describe('payoutDueOn', () => {
  const weekly = (weekday: number) => ({
    storeSettlementCycle: StoreSettlementCycle.WEEKLY,
    storeSettlementDelayDays: 1,
    storeSettlementPayoutWeekday: weekday,
  });

  it('주 단위: 그 주(월~일)의 다음 주 정한 요일에 지급한다', () => {
    // 2026-10-15는 목요일. 다음 주 수요일은 10-21.
    expect(payoutDueOn(kst('2026-10-15'), weekly(3))).toBe('2026-10-21');
    // 그 주 월요일 0시도, 일요일 밤도 같은 주다.
    expect(payoutDueOn(kst('2026-10-12', '00:00'), weekly(3))).toBe(
      '2026-10-21',
    );
    expect(payoutDueOn(kst('2026-10-18', '23:59'), weekly(3))).toBe(
      '2026-10-21',
    );
    // 지급일을 일요일(0)로 정하면 다음 주 일요일.
    expect(payoutDueOn(kst('2026-10-15'), weekly(0))).toBe('2026-10-25');
  });

  it('일 단위: 그날(한국 날짜)에서 정한 날만큼 뒤', () => {
    const daily = {
      storeSettlementCycle: StoreSettlementCycle.DAILY,
      storeSettlementDelayDays: 2,
      storeSettlementPayoutWeekday: 3,
    };
    // 한국 시각 00:30은 UTC로 전날이지만 한국 날짜로 센다.
    expect(payoutDueOn(kst('2026-10-15', '00:30'), daily)).toBe('2026-10-17');
  });
});

describe('saleEntry', () => {
  it('메뉴 금액 + 배달팁 − 중개수수료 − 결제수수료 − 배달대행료', () => {
    const entry = saleEntry({
      id: 'entry-1',
      order: {
        id: 'order-1',
        storeId: 'store-1',
        menuAmount: 20000,
        deliveryTip: 3000,
        paymentAmount: 23000,
        commissionRatePercent: 1.5,
        paymentFeeRatePercent: 3,
      } as FoodOrderState,
      deliveryFee: 3500,
      dueOn: '2026-10-21',
      now: new Date(),
    });
    expect(entry).toMatchObject({
      kind: StoreSettlementEntryKind.SALE,
      commission: 300,
      paymentFee: 690,
      deliveryFee: 3500,
      amount: 20000 + 3000 - 300 - 690 - 3500,
      payoutId: null,
    });
  });

  it('가게가 내는 금액은 음수로 쌓는다', () => {
    expect(
      chargeEntry({
        id: 'entry-2',
        storeId: 'store-1',
        foodOrderId: 'order-1',
        kind: StoreSettlementEntryKind.CANCELLATION_FEE,
        amount: 525,
        memo: '취소 수수료',
        dueOn: '2026-10-21',
        now: new Date(),
      }).amount,
    ).toBe(-525);
  });
});

describe('settlementAccount', () => {
  it('계좌번호는 숫자만 남기고, 확인 전 상태로 만든다', () => {
    const account = settlementAccount({
      storeId: 'store-1',
      bankName: ' 국민은행 ',
      accountNumber: '123456-01-234567',
      accountHolder: '모보치킨',
      now: new Date(),
    });
    expect(account).toMatchObject({
      bankName: '국민은행',
      accountNumber: '12345601234567',
      verifiedAt: null,
    });
    expect(maskAccountNumber(account.accountNumber)).toBe('••••4567');
  });

  it('계좌번호가 10~16자리가 아니면 받지 않는다', () => {
    expect(() =>
      settlementAccount({
        storeId: 'store-1',
        bankName: '국민은행',
        accountNumber: '1234',
        accountHolder: '모보치킨',
        now: new Date(),
      }),
    ).toThrow(expect.objectContaining({ code: 'INVALID_SETTLEMENT_ACCOUNT' }));
  });
});
