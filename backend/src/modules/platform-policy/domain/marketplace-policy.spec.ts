import { InvalidArgumentError } from '../../../common/domain/domain-error.js';
import {
  DEFAULT_MARKETPLACE_POLICY,
  normalizeMarketplacePolicy,
  StoreSettlementCycle,
} from './marketplace-policy.js';

describe('주문앱 정책', () => {
  it('저장된 값에 빠진 칸은 처음 값으로 채운다 (새로 생긴 정책)', () => {
    expect(normalizeMarketplacePolicy({ commissionRatePercent: 1.5 })).toEqual({
      ...DEFAULT_MARKETPLACE_POLICY,
      commissionRatePercent: 1.5,
    });
  });

  it('수수료율은 범위 안, 소수 둘째 자리까지', () => {
    expect(
      normalizeMarketplacePolicy({ paymentFeeRatePercent: 3.25 })
        .paymentFeeRatePercent,
    ).toBe(3.25);
    for (const bad of [-1, 31, 1.234, Number.NaN]) {
      expect(() =>
        normalizeMarketplacePolicy({ commissionRatePercent: bad }),
      ).toThrow(InvalidArgumentError);
    }
  });

  it('정산 주기와 요일, 지연일을 확인한다', () => {
    expect(
      normalizeMarketplacePolicy({
        storeSettlementCycle: StoreSettlementCycle.DAILY,
        storeSettlementDelayDays: 0,
      }).storeSettlementCycle,
    ).toBe(StoreSettlementCycle.DAILY);
    expect(() =>
      normalizeMarketplacePolicy({
        storeSettlementCycle: 'MONTHLY' as StoreSettlementCycle,
      }),
    ).toThrow('정산 주기');
    expect(() =>
      normalizeMarketplacePolicy({ storeSettlementPayoutWeekday: 7 }),
    ).toThrow(InvalidArgumentError);
  });
});
