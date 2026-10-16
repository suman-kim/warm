import {
  BusinessNumber,
  Store,
  StoreStatus,
  WalletEntryKind,
} from './store.entity.js';

const AT = new Date('2026-10-15T01:00:00Z');
const PROFILE = {
  name: ' 모보치킨 역삼점 ',
  businessNumber: '220-81-62517',
  phone: '02-555-1234',
  address: {
    address: '서울 강남구 테헤란로 152',
    sigungu: '강남구',
    dong: '역삼동',
    latitude: 37.5,
    longitude: 127.0364,
  },
};

function approvedStore(): Store {
  const store = Store.register({
    id: 's1',
    ownerUserId: 'u1',
    profile: PROFILE,
    now: AT,
  });
  store.approve('admin-1', AT);
  return store;
}

describe('Store', () => {
  it('등록하면 심사 대기이고, 상호·번호를 정리해 둔다', () => {
    const store = Store.register({
      id: 's1',
      ownerUserId: 'u1',
      profile: PROFILE,
      now: AT,
    });
    expect(store.snapshot()).toMatchObject({
      name: '모보치킨 역삼점',
      businessNumber: '2208162517',
      phone: '025551234',
      status: StoreStatus.PENDING,
      walletBalance: 0,
      address: { detailAddress: null },
    });
  });

  it('사업자등록번호는 검증 숫자까지 맞아야 한다', () => {
    expect(BusinessNumber.isValid('2208162517')).toBe(true);
    expect(() => BusinessNumber.of('220-81-62518')).toThrow(/사업자등록번호/);
    expect(() =>
      Store.register({
        id: 's1',
        ownerUserId: 'u1',
        profile: { ...PROFILE, businessNumber: '123' },
        now: AT,
      }),
    ).toThrow(/사업자등록번호/);
  });

  it('반려된 가게가 정보를 고치면 다시 심사를 받는다', () => {
    const store = Store.register({
      id: 's1',
      ownerUserId: 'u1',
      profile: PROFILE,
      now: AT,
    });
    store.reject(' 상호가 달라요 ', 'admin-1', AT);
    expect(store.snapshot().rejectionReason).toBe('상호가 달라요');

    store.updateProfile(
      { ...PROFILE, name: '모보치킨' },
      new Date('2026-10-16T00:00:00Z'),
    );
    expect(store.status).toBe(StoreStatus.PENDING);
    expect(store.snapshot().appliedAt).toEqual(
      new Date('2026-10-16T00:00:00Z'),
    );
  });

  it('승인된 가게의 사업자등록번호는 바꿀 수 없다', () => {
    const store = approvedStore();
    expect(() =>
      store.updateProfile({ ...PROFILE, businessNumber: '1248100998' }, AT),
    ).toThrow(expect.objectContaining({ code: 'BUSINESS_NUMBER_LOCKED' }));
  });

  it('충전·차감·환불·조정마다 잔액이 바뀌고 내역이 쌓인다', () => {
    const store = approvedStore();
    store.topUp({ entryId: 'e1', amount: 50_000, now: AT });
    store.chargeDeliveryFee({
      entryId: 'e2',
      orderId: 'o1',
      amount: 4_000,
      now: AT,
    });
    store.refundDeliveryFee({
      entryId: 'e3',
      orderId: 'o1',
      amount: 4_000,
      memo: '배차 전 취소',
      now: AT,
    });
    store.adjust({
      entryId: 'e4',
      amount: -1_000,
      memo: ' 보상 ',
      adminId: 'admin-1',
      now: AT,
    });

    expect(store.walletBalance).toBe(49_000);
    expect(
      store.pullNewEntries().map((e) => [e.kind, e.amount, e.balanceAfter]),
    ).toEqual([
      [WalletEntryKind.TOP_UP, 50_000, 50_000],
      [WalletEntryKind.DELIVERY_FEE, -4_000, 46_000],
      [WalletEntryKind.REFUND, 4_000, 50_000],
      [WalletEntryKind.ADJUSTMENT, -1_000, 49_000],
    ]);
    expect(store.pullNewEntries()).toEqual([]);
  });

  it('잔액이 모자라거나 승인 전이면 대행료를 차감하지 않는다', () => {
    const pending = Store.register({
      id: 's1',
      ownerUserId: 'u1',
      profile: PROFILE,
      now: AT,
    });
    expect(() =>
      pending.chargeDeliveryFee({
        entryId: 'e1',
        orderId: 'o1',
        amount: 4_000,
        now: AT,
      }),
    ).toThrow(expect.objectContaining({ code: 'STORE_NOT_APPROVED' }));

    const store = approvedStore();
    store.topUp({ entryId: 'e1', amount: 10_000, now: AT });
    store.chargeDeliveryFee({
      entryId: 'e2',
      orderId: 'o1',
      amount: 6_000,
      now: AT,
    });
    expect(() =>
      store.chargeDeliveryFee({
        entryId: 'e3',
        orderId: 'o2',
        amount: 6_000,
        now: AT,
      }),
    ).toThrow(expect.objectContaining({ code: 'INSUFFICIENT_WALLET_BALANCE' }));
    expect(store.walletBalance).toBe(4_000);
  });

  it('충전은 1만~200만 원, 조정은 잔액 아래로 내려가지 않는다', () => {
    const store = approvedStore();
    expect(() =>
      store.topUp({ entryId: 'e1', amount: 9_999, now: AT }),
    ).toThrow(expect.objectContaining({ code: 'INVALID_TOP_UP_AMOUNT' }));
    expect(() =>
      store.adjust({
        entryId: 'e2',
        amount: -1,
        memo: '실수',
        adminId: 'a',
        now: AT,
      }),
    ).toThrow(expect.objectContaining({ code: 'INSUFFICIENT_WALLET_BALANCE' }));
  });
});
