import {
  FoodOrder,
  FoodOrderCanceller,
  FoodOrderStatus,
  RefundBearer,
  RefundStatus,
} from './food-order.entity.js';

const NOW = new Date('2026-10-15T03:00:00Z');
const later = (minutes: number) => new Date(NOW.getTime() + minutes * 60_000);

function placed(): FoodOrder {
  return FoodOrder.place({
    id: '3f9a1c2e-0000-4000-8000-000000000001',
    consumerUserId: 'consumer-1',
    storeId: 'store-1',
    storeOwnerUserId: 'owner-1',
    storeName: '모보치킨',
    lines: [
      {
        menuItemId: 'm1',
        name: '후라이드 치킨',
        unitPrice: 18000,
        quantity: 1,
        options: [],
        lineTotal: 18000,
      },
      {
        menuItemId: 'm2',
        name: '콜라',
        unitPrice: 2000,
        quantity: 1,
        options: [],
        lineTotal: 2000,
      },
    ],
    menuAmount: 20000,
    deliveryTip: 3000,
    dropoff: {
      address: '서울 강남구 역삼로 180',
      detailAddress: null,
      sigungu: '강남구',
      dong: '역삼동',
      latitude: 37.4955,
      longitude: 127.0495,
    },
    consumerPhone: '01012345678',
    distanceKm: 1.3,
    storeRequest: ' 덜 맵게 ',
    riderRequest: null,
    disposableCutlery: false,
    commissionRatePercent: 2,
    paymentFeeRatePercent: 3,
    paymentId: 'food-1',
    createdAt: NOW,
  });
}

function paid(): FoodOrder {
  const order = placed();
  order.markPaid(23000, later(1));
  order.pullDomainEvents();
  return order;
}

describe('FoodOrder', () => {
  it('결제 금액은 메뉴 금액과 배달팁의 합이고, 주문번호는 날짜와 ID로 만든다', () => {
    const order = placed();
    expect(order.snapshot()).toMatchObject({
      paymentAmount: 23000,
      status: FoodOrderStatus.PENDING_PAYMENT,
      storeRequest: '덜 맵게',
    });
    expect(order.code).toBe('TK261015-3F9A');
    expect(order.summary()).toBe('후라이드 치킨 외 1개');
  });

  it('결제 금액이 다르면 받지 않고, 맞으면 가게에 새 주문이 들어간다', () => {
    const order = placed();
    expect(() => order.markPaid(22000, NOW)).toThrow(
      expect.objectContaining({ code: 'PAYMENT_AMOUNT_MISMATCH' }),
    );
    order.markPaid(23000, NOW);
    expect(order.status).toBe(FoodOrderStatus.PLACED);
    expect(order.pullDomainEvents().map((event) => event.eventName)).toEqual([
      'food-order.placed',
    ]);
  });

  it('가게가 받으면 배달을 잇고, 픽업·완료를 거쳐 끝난다', () => {
    const order = paid();
    order.accept(20, 'delivery-1', later(2));
    order.markPickedUp(later(25));
    order.markPickedUp(later(26)); // 이벤트가 두 번 와도 그대로
    expect(order.markDelivered(later(40))).toBe(true);
    expect(order.markDelivered(later(41))).toBe(false);
    expect(order.snapshot()).toMatchObject({
      status: FoodOrderStatus.DELIVERED,
      cookMinutes: 20,
      deliveryOrderId: 'delivery-1',
      pickedUpAt: later(25),
    });
    expect(order.pullDomainEvents().map((event) => event.eventName)).toEqual([
      'food-order.accepted',
      'food-order.picked-up',
      'food-order.delivered',
    ]);
  });

  it('가게가 거절하면 결제한 금액을 모두 돌려준다', () => {
    const order = paid();
    expect(() => order.reject(' ', 'refund-1', NOW)).toThrow(
      expect.objectContaining({ code: 'REJECT_REASON_REQUIRED' }),
    );
    order.reject('재료 소진', 'refund-1', later(3));
    expect(order.status).toBe(FoodOrderStatus.REJECTED);
    expect(order.unsettledRefunds).toEqual([
      expect.objectContaining({
        amount: 23000,
        status: RefundStatus.PENDING,
        borneBy: null,
      }),
    ]);
    expect(order.refundableAmount).toBe(0);
    expect(order.gatewayCancellableAmount).toBe(23000);

    order.completeRefund('refund-1', later(4));
    expect(order.unsettledRefunds).toEqual([]);
    expect(order.gatewayCancellableAmount).toBe(0);
  });

  it('손님은 가게가 받기 전까지만 취소한다. 결제 전 취소는 돌려줄 것이 없다', () => {
    const unpaid = placed();
    unpaid.cancel(FoodOrderCanceller.CONSUMER, '', 'refund-1', NOW);
    expect(unpaid.unsettledRefunds).toEqual([]);

    const accepted = paid();
    accepted.accept(10, 'delivery-1', later(2));
    expect(() =>
      accepted.cancel(FoodOrderCanceller.CONSUMER, '', 'refund-1', later(3)),
    ).toThrow(expect.objectContaining({ code: 'FOOD_ORDER_NOT_CANCELLABLE' }));
    // 가게와 운영자는 받은 뒤에도 (픽업 전까지) 취소할 수 있다.
    accepted.cancel(
      FoodOrderCanceller.STORE,
      '재료 소진',
      'refund-1',
      later(3),
    );
    expect(accepted.snapshot()).toMatchObject({
      status: FoodOrderStatus.CANCELLED,
      cancelledBy: FoodOrderCanceller.STORE,
    });
    expect(accepted.unsettledRefunds[0].amount).toBe(23000);
  });

  it('가게는 받기 전 주문을 취소하지 못한다 (거절한다)', () => {
    expect(() =>
      paid().cancel(FoodOrderCanceller.STORE, '', 'refund-1', NOW),
    ).toThrow(expect.objectContaining({ code: 'FOOD_ORDER_NOT_CANCELLABLE' }));
  });

  it('배달이 끝난 주문은 남은 금액 안에서 부분 환불한다', () => {
    const order = paid();
    order.accept(10, 'delivery-1', later(2));
    order.markDelivered(later(30));
    const refund = (amount: number) =>
      order.refundPartially({
        id: `refund-${amount}`,
        amount,
        reason: '메뉴 누락',
        borneBy: RefundBearer.STORE,
        adminId: 'admin-1',
        now: later(60),
      });
    refund(5000);
    expect(order.refundableAmount).toBe(18000);
    expect(() => refund(18001)).toThrow(
      expect.objectContaining({ code: 'REFUND_EXCEEDS_PAID' }),
    );
    order.failRefund('refund-5000', 'PG 오류');
    expect(order.unsettledRefunds[0]).toMatchObject({
      status: RefundStatus.FAILED,
      failureReason: 'PG 오류',
    });
  });

  it('리뷰는 내가 시킨, 배달이 끝난 주문에 기간 안에만 쓴다', () => {
    const order = paid();
    expect(() => order.assertReviewable('consumer-1', 7, later(5))).toThrow(
      expect.objectContaining({ code: 'FOOD_ORDER_NOT_DELIVERED' }),
    );
    order.accept(10, 'delivery-1', later(2));
    order.markDelivered(later(30));
    expect(() => order.assertReviewable('other', 7, later(40))).toThrow(
      expect.objectContaining({ code: 'NOT_FOOD_ORDER_OWNER' }),
    );
    expect(() =>
      order.assertReviewable('consumer-1', 7, later(40)),
    ).not.toThrow();
    expect(() =>
      order.assertReviewable('consumer-1', 7, later(30 + 7 * 24 * 60 + 1)),
    ).toThrow(expect.objectContaining({ code: 'REVIEW_WINDOW_CLOSED' }));
  });
});
