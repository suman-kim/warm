import {
  ClosedReason,
  DEFAULT_STOREFRONT_SETTINGS,
  FoodCategory,
  Storefront,
  StorefrontSettings,
} from './storefront.entity.js';

// 2026-10-15(목) 한국 시각을 UTC로 만든다.
const kst = (date: string, time: string) =>
  new Date(`${date}T${time}:00+09:00`);
const THURSDAY = '2026-10-15';

function settings(
  overrides: Partial<StorefrontSettings> = {},
): StorefrontSettings {
  return { ...structuredClone(DEFAULT_STOREFRONT_SETTINGS), ...overrides };
}

function openStorefront(
  overrides: Partial<StorefrontSettings> = {},
): Storefront {
  const storefront = Storefront.create('store-1', kst(THURSDAY, '09:00'));
  storefront.updateSettings(settings(overrides), kst(THURSDAY, '09:00'));
  storefront.setOpen(true, kst(THURSDAY, '09:00'));
  return storefront;
}

describe('Storefront', () => {
  it('처음에는 주문 받기가 꺼져 있다', () => {
    const storefront = Storefront.create('store-1', new Date());
    expect(storefront.availability(kst(THURSDAY, '12:00'))).toBe(
      ClosedReason.NOT_OPENED,
    );
  });

  it('영업시간 안에만 주문을 받는다 (한국 시간)', () => {
    const storefront = openStorefront();
    expect(storefront.availability(kst(THURSDAY, '10:59'))).toBe(
      ClosedReason.OUTSIDE_HOURS,
    );
    expect(storefront.availability(kst(THURSDAY, '11:00'))).toBeNull();
    expect(storefront.availability(kst(THURSDAY, '21:59'))).toBeNull();
    expect(storefront.availability(kst(THURSDAY, '22:00'))).toBe(
      ClosedReason.OUTSIDE_HOURS,
    );
  });

  it('새벽까지 여는 날은 다음 날 새벽에도 받는다', () => {
    const hours = settings().businessHours;
    hours[4] = { open: '17:00', close: '02:00' }; // 목요일
    hours[5] = null; // 금요일은 쉬지만 목요일 밤 영업은 이어진다
    const storefront = openStorefront({ businessHours: hours });
    expect(storefront.availability(kst(THURSDAY, '23:30'))).toBeNull();
    expect(storefront.availability(kst('2026-10-16', '01:30'))).toBeNull();
    expect(storefront.availability(kst('2026-10-16', '02:00'))).toBe(
      ClosedReason.OUTSIDE_HOURS,
    );
  });

  it('쉬는 날·임시 휴업·운영자가 내린 가게는 받지 않는다', () => {
    expect(
      openStorefront({ holidays: [THURSDAY] }).availability(
        kst(THURSDAY, '12:00'),
      ),
    ).toBe(ClosedReason.HOLIDAY);

    const paused = openStorefront();
    paused.pause(30, kst(THURSDAY, '12:00'));
    expect(paused.availability(kst(THURSDAY, '12:29'))).toBe(
      ClosedReason.PAUSED,
    );
    expect(paused.availability(kst(THURSDAY, '12:30'))).toBeNull();

    const hidden = openStorefront();
    hidden.setHidden(true, '원산지 표시 누락', new Date());
    expect(hidden.availability(kst(THURSDAY, '12:00'))).toBe(
      ClosedReason.HIDDEN,
    );
    expect(() => hidden.setHidden(true, ' ', new Date())).toThrow('사유');
  });

  it('배달팁은 주문금액별 기준 중 가장 큰 것에 거리별 추가 팁을 더한다', () => {
    const storefront = openStorefront({
      deliveryTipRules: [
        { minOrderAmount: 0, tip: 4000 },
        { minOrderAmount: 20000, tip: 2000 },
        { minOrderAmount: 30000, tip: 0 },
      ],
      distanceTipRules: [
        { overKm: 1.5, extra: 500 },
        { overKm: 2.5, extra: 1000 },
      ],
    });
    expect(storefront.deliveryTipFor(15000, 1.0)).toBe(4000);
    expect(storefront.deliveryTipFor(20000, 2.0)).toBe(2500);
    expect(storefront.deliveryTipFor(35000, 3.0)).toBe(1000);
  });

  it('잘못된 설정은 받지 않는다', () => {
    const storefront = Storefront.create('store-1', new Date());
    const update = (overrides: Partial<StorefrontSettings>) => () =>
      storefront.updateSettings(settings(overrides), new Date());
    expect(update({ category: 'NOODLE' as FoodCategory })).toThrow(
      expect.objectContaining({ code: 'INVALID_CATEGORY' }),
    );
    expect(update({ maxDeliveryKm: 10.5 })).toThrow(
      expect.objectContaining({ code: 'INVALID_DELIVERY_DISTANCE' }),
    );
    expect(update({ maxDeliveryKm: 2.25 })).toThrow(
      expect.objectContaining({ code: 'INVALID_DELIVERY_DISTANCE' }),
    );
    expect(
      update({ deliveryTipRules: [{ minOrderAmount: 10000, tip: 3000 }] }),
    ).toThrow(expect.objectContaining({ code: 'INVALID_DELIVERY_TIP' }));
    expect(
      update({
        deliveryTipRules: [
          { minOrderAmount: 0, tip: 3000 },
          { minOrderAmount: 0, tip: 1000 },
        ],
      }),
    ).toThrow(expect.objectContaining({ code: 'INVALID_DELIVERY_TIP' }));
    expect(
      update({ businessHours: settings().businessHours.slice(0, 6) }),
    ).toThrow(expect.objectContaining({ code: 'INVALID_BUSINESS_HOURS' }));
    expect(
      update({
        businessHours: Array.from({ length: 7 }, () => ({
          open: '25:00',
          close: '22:00',
        })),
      }),
    ).toThrow(expect.objectContaining({ code: 'INVALID_BUSINESS_HOURS' }));
    expect(update({ holidays: ['2026-13-01'] })).toThrow(
      expect.objectContaining({ code: 'INVALID_HOLIDAYS' }),
    );
  });

  it('임시 휴업은 24시간까지다', () => {
    const storefront = openStorefront();
    expect(() => storefront.pause(24 * 60 + 1, new Date())).toThrow(
      expect.objectContaining({ code: 'INVALID_PAUSE' }),
    );
    storefront.pause(60, kst(THURSDAY, '12:00'));
    storefront.pause(null, kst(THURSDAY, '12:10'));
    expect(storefront.availability(kst(THURSDAY, '12:10'))).toBeNull();
  });
});
