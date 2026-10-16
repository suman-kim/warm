import {
  ConflictError,
  ForbiddenError,
  InvalidArgumentError,
} from '../../../../common/domain/domain-error.js';
import { DISPATCH_RADIUS_KM } from '../../../../common/domain/dispatch-area.js';
import { OrderRequestedEvent } from '../events/order.events.js';
import { OrderStatus } from '../order-status.js';
import { Money } from '../value-objects/money.js';
import { DoorPayment } from '../value-objects/store-delivery.js';
import { Waypoint } from '../value-objects/waypoint.js';
import { Order, RequestDeliveryInput } from './order.entity.js';

const NOW = new Date('2026-10-15T09:00:00Z');
const LATER = new Date('2026-10-15T09:10:00Z');
const OWNER = 'owner-1';
const RIDER = 'driver-1';

const waypoint = (
  address: string,
  sigungu: string,
  dong: string,
  name: string,
) =>
  Waypoint.of({
    address,
    sigungu,
    dong,
    latitude: 37.5,
    longitude: 127.03,
    contactName: name,
    contactPhone: '050-1234-5678',
  });

function request(overrides: Partial<RequestDeliveryInput> = {}): Order {
  return Order.request({
    id: 'order-1',
    ownerUserId: OWNER,
    storeId: 'store-1',
    pickup: waypoint(
      '서울 강남구 테헤란로 152',
      '강남구',
      '역삼동',
      '모보치킨',
    ),
    dropoff: waypoint('서울 강남구 역삼로 180', '강남구', '역삼동', '손님'),
    distanceKm: 1.3,
    durationMinutes: 7,
    deliveryFee: Money.won(3500),
    foodAmount: 23000,
    doorPayment: DoorPayment.CASH,
    readyAt: null,
    now: NOW,
    ...overrides,
  });
}

const eventNames = (order: Order) =>
  order.pullDomainEvents().map((event) => event.eventName);

const minutesAfter = (at: Date, minutes: number) =>
  new Date(at.getTime() + minutes * 60_000);

/** 라이더가 수락한 배달. */
function assigned(
  order = request(),
  estimatedPickupAt: Date | null = null,
): Order {
  order.assign(RIDER, LATER, estimatedPickupAt);
  return order;
}

describe('Order (배달)', () => {
  describe('request', () => {
    it('배차 대기로 시작하고 대행료가 요금이다', () => {
      const state = request().snapshot();
      expect(state.status).toBe(OrderStatus.REQUESTED);
      expect(state.driverId).toBeNull();
      expect(state.fare.amount).toBe(3500);
      expect(state.storeDelivery).toMatchObject({
        storeId: 'store-1',
        foodAmount: 23000,
        doorPayment: DoorPayment.CASH,
        collectedMethod: null,
      });
    });

    it('요청 이벤트에는 동 단위 위치와 대행료, 배차 반경을 싣는다', () => {
      const [event] = request().pullDomainEvents() as OrderRequestedEvent[];
      expect(event).toBeInstanceOf(OrderRequestedEvent);
      expect(event.pickupArea).toBe('강남구 역삼동');
      expect(event.fareAmount).toBe(3500);
      expect(event.dispatchRadiusKm).toBe(DISPATCH_RADIUS_KM);
    });

    it('조리 완료 시각은 지금보다 뒤일 때만 남긴다', () => {
      const ready = minutesAfter(NOW, 15);
      expect(request({ readyAt: ready }).storeDelivery.readyAt).toEqual(ready);
      expect(request({ readyAt: NOW }).storeDelivery.readyAt).toBeNull();
    });

    it('만나서 결제는 받을 음식값이 있어야 한다', () => {
      expect(() => request({ foodAmount: 0 })).toThrow(InvalidArgumentError);
      expect(
        request({ foodAmount: 0, doorPayment: DoorPayment.PREPAID }).status,
      ).toBe(OrderStatus.REQUESTED);
    });

    it('요청 사항은 500자까지다', () => {
      expect(() => request({ memo: '가'.repeat(501) })).toThrow(
        InvalidArgumentError,
      );
    });
  });

  describe('assign', () => {
    it('먼저 수락한 라이더가 잡고, 다른 라이더는 수락할 수 없다', () => {
      const order = assigned(request(), minutesAfter(LATER, 6));
      const state = order.snapshot();
      expect(state.status).toBe(OrderStatus.ASSIGNED);
      expect(state.driverId).toBe(RIDER);
      expect(state.assignedAt).toEqual(LATER);
      expect(state.estimatedPickupAt).toEqual(minutesAfter(LATER, 6));
      expect(() => order.assign('driver-2', LATER)).toThrow(ConflictError);
    });

    it('취소된 배달은 수락할 수 없다', () => {
      const order = request();
      order.cancelByCustomer(OWNER, '손님이 취소했어요', LATER);
      expect(() => order.assign(RIDER, LATER)).toThrow(ConflictError);
    });
  });

  describe('진행: 가게 도착 → 픽업 → 배달 완료', () => {
    it('단계마다 시각을 남기고 이벤트를 낸다', () => {
      const order = assigned();
      order.arrive(RIDER, minutesAfter(LATER, 5));
      order.pickUp(RIDER, minutesAfter(LATER, 8));
      order.deliver(RIDER, minutesAfter(LATER, 20), {
        method: DoorPayment.CASH,
        amount: 23000,
      });
      const state = order.snapshot();
      expect(state.status).toBe(OrderStatus.DELIVERED);
      // 출발을 누르지 않고 도착하면 그때 출발한 것으로 본다.
      expect(state.departedAt).toEqual(minutesAfter(LATER, 5));
      expect(state.arrivedAt).toEqual(minutesAfter(LATER, 5));
      expect(state.pickedUpAt).toEqual(minutesAfter(LATER, 8));
      expect(state.deliveredAt).toEqual(minutesAfter(LATER, 20));
      expect(state.storeDelivery).toMatchObject({
        collectedMethod: DoorPayment.CASH,
        collectedAmount: 23000,
      });
      expect(eventNames(order)).toEqual([
        'order.requested',
        'order.assigned',
        'order.arrived',
        'order.picked-up',
        'order.delivered',
      ]);
    });

    it('만나서 결제는 받은 방식과 금액이 있어야 완료된다', () => {
      const order = assigned();
      order.pickUp(RIDER, LATER);
      expect(() => order.deliver(RIDER, LATER)).toThrow('받은 방식과 금액');
    });

    it('선결제는 받은 돈 없이 완료된다', () => {
      const order = assigned(
        request({ doorPayment: DoorPayment.PREPAID, foodAmount: 0 }),
      );
      order.pickUp(RIDER, LATER);
      order.deliver(RIDER, LATER);
      expect(order.storeDelivery.collectedMethod).toBeNull();
    });

    it('픽업하지 않고 완료할 수 없고, 배차받지 않은 라이더는 진행할 수 없다', () => {
      const order = assigned();
      expect(() => order.deliver(RIDER, LATER)).toThrow(ConflictError);
      expect(() => order.arrive('driver-2', LATER)).toThrow(ForbiddenError);
    });

    it('도착 예정은 픽업 예정(또는 픽업) 시각에 소요 시간을 더한다', () => {
      expect(request().estimatedDeliveryAt).toBeNull();
      const order = assigned(request(), minutesAfter(LATER, 6));
      expect(order.estimatedDeliveryAt).toEqual(minutesAfter(LATER, 13));
      order.pickUp(RIDER, minutesAfter(LATER, 10));
      expect(order.estimatedDeliveryAt).toEqual(minutesAfter(LATER, 17));
    });
  });

  describe('markCashHanded', () => {
    it('현금으로 받은 배달만 가게에 넘김으로 표시하고, 처음 시각을 지킨다', () => {
      const order = assigned();
      order.pickUp(RIDER, LATER);
      order.deliver(RIDER, LATER, { method: DoorPayment.CASH, amount: 23000 });
      order.markCashHanded(true, minutesAfter(LATER, 30));
      order.markCashHanded(true, minutesAfter(LATER, 60));
      expect(order.storeDelivery.cashHandedAt).toEqual(minutesAfter(LATER, 30));
      order.markCashHanded(false, minutesAfter(LATER, 70));
      expect(order.storeDelivery.cashHandedAt).toBeNull();

      const card = assigned(request({ doorPayment: DoorPayment.CARD }));
      card.pickUp(RIDER, LATER);
      card.deliver(RIDER, LATER, { method: DoorPayment.CARD, amount: 23000 });
      expect(() => card.markCashHanded(true, LATER)).toThrow(ConflictError);
    });
  });

  describe('cancelByCustomer', () => {
    it('라이더가 출발·도착하기 전에는 수수료 없이 모두 돌려준다', () => {
      const order = assigned();
      expect(order.cancellationFeeNow()).toBe(0);
      order.cancelByCustomer(OWNER, '음식을 준비할 수 없어요', LATER);
      expect(order.status).toBe(OrderStatus.CANCELLED);
      expect(order.refundDueOnCancel()).toBe(3500);
      expect(order.snapshot().cancelReason).toBe('음식을 준비할 수 없어요');
    });

    it('라이더가 가게에 온 뒤에는 대행료의 15%를 원 단위로 뺀다', () => {
      const order = assigned();
      order.arrive(RIDER, LATER);
      expect(order.cancellationFeeNow()).toBe(525);
      order.cancelByCustomer(OWNER, '손님이 취소했어요', LATER);
      expect(order.refundDueOnCancel()).toBe(2975);
    });

    it('픽업한 뒤나 남의 배달은 취소할 수 없다', () => {
      const order = assigned();
      expect(() => order.cancelByCustomer('owner-2', '', LATER)).toThrow(
        ForbiddenError,
      );
      order.pickUp(RIDER, LATER);
      expect(order.cancellationFeeNow()).toBeNull();
      expect(() => order.cancelByCustomer(OWNER, '', LATER)).toThrow(
        ConflictError,
      );
    });
  });

  it('주문번호는 요청한 한국 날짜와 ID 앞 네 자리다', () => {
    expect(request({ id: '3f9a1234-0000' }).code).toBe('MV261015-3F9A');
  });
});
