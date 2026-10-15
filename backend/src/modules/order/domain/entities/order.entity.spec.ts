import {
  ConflictError,
  ForbiddenError,
  InvalidArgumentError,
} from '../../../../common/domain/domain-error.js';
import {
  ServiceType,
  VehicleType,
} from '../../../../common/domain/vehicle-type.js';
import { OrderStatus } from '../order-status.js';
import { LoadingHelp } from '../services/charge-policy.js';
import { Cargo, CargoCategory } from '../value-objects/cargo.js';
import { Money } from '../value-objects/money.js';
import { Waypoint } from '../value-objects/waypoint.js';
import { Order, RequestOrderInput } from './order.entity.js';

const NOW = new Date('2026-10-13T09:00:00Z');
const LATER = new Date('2026-10-13T09:10:00Z');
const CUSTOMER = 'customer-1';
const DRIVER = { id: 'driver-1', vehicleType: VehicleType.DAMAS };

const waypoint = (address: string, sigungu?: string, dong?: string) =>
  Waypoint.of({
    address,
    sigungu,
    dong,
    latitude: 37.5,
    longitude: 127.03,
    contactName: '홍길동',
    contactPhone: '010-1234-5678',
  });

function requestOrder(overrides: Partial<RequestOrderInput> = {}): Order {
  return Order.request({
    id: 'order-1',
    customerId: CUSTOMER,
    vehicleType: VehicleType.DAMAS,
    pickup: waypoint('서울 강남구 테헤란로 152', '강남구', '역삼동'),
    dropoff: waypoint('서울 마포구 양화로 45', '마포구', '서교동'),
    cargo: Cargo.of({ category: CargoCategory.BOX, weightKg: 30 }),
    distanceKm: 12,
    durationMinutes: 40,
    baseFare: Money.won(28400),
    paymentMethodId: 'card-1',
    now: NOW,
    ...overrides,
  });
}

const eventNames = (order: Order) =>
  order.pullDomainEvents().map((event) => event.eventName);

const minutesAfter = (at: Date, minutes: number) =>
  new Date(at.getTime() + minutes * 60_000);

/** 기사가 수락하고 결제가 끝나 배차된 주문. */
function assign(order: Order, estimatedPickupAt: Date | null = null): Order {
  order.reserveForPayment(DRIVER);
  order.confirmAssignment(LATER, estimatedPickupAt);
  return order;
}

describe('Order', () => {
  describe('request', () => {
    it('배차 대기 상태로 시작하고 차종에서 서비스 종류를 정한다', () => {
      const quick = requestOrder().snapshot();
      const freight = requestOrder({
        vehicleType: VehicleType.TRUCK_1T,
      }).snapshot();

      expect(quick.status).toBe(OrderStatus.REQUESTED);
      expect(quick.driverId).toBeNull();
      expect(quick.serviceType).toBe(ServiceType.QUICK);
      expect(freight.serviceType).toBe(ServiceType.FREIGHT);
    });

    it('운반 도움과 엘리베이터 없는 층의 계단 요금을 배차 때 결제할 요금에 더한다', () => {
      const order = requestOrder({
        loadingHelp: LoadingHelp.TOGETHER,
        pickupAccess: { floor: 1, elevator: false },
        dropoffAccess: { floor: 3, elevator: false },
      });

      expect(order.snapshot()).toMatchObject({
        baseFare: Money.won(28400),
        helpFee: Money.won(10000),
        stairFee: Money.won(6000),
      });
      expect(order.fare).toBe(44400);
      expect(order.totalFare).toBe(44400);
    });

    it('엘리베이터가 있으면 층이 높아도 계단 요금이 없다', () => {
      const order = requestOrder({
        dropoffAccess: { floor: 12, elevator: true },
      });

      expect(order.fare).toBe(28400);
    });

    it('층은 1층부터 99층까지다', () => {
      expect(() =>
        requestOrder({ pickupAccess: { floor: 0, elevator: true } }),
      ).toThrow(InvalidArgumentError);
    });

    it('요청 이벤트를 한 번 남긴다', () => {
      const order = requestOrder();

      expect(eventNames(order)).toEqual(['order.requested']);
      expect(eventNames(order)).toEqual([]);
    });

    it('요청 이벤트에는 위치를 동 단위까지만 싣는다', () => {
      const [event] = requestOrder().pullDomainEvents();

      expect(event).toMatchObject({
        pickupArea: '강남구 역삼동',
        dropoffArea: '마포구 서교동',
        fareAmount: 28400,
      });
      expect(JSON.stringify(event)).not.toContain('테헤란로');
    });

    it('차종의 최대 적재 중량을 넘는 화물은 거절한다', () => {
      const tooHeavy = Cargo.of({
        category: CargoCategory.FURNITURE_APPLIANCE,
        description: '냉장고',
        weightKg: 20.5,
      });

      expect(() =>
        requestOrder({ vehicleType: VehicleType.MOTORCYCLE, cargo: tooHeavy }),
      ).toThrow(InvalidArgumentError);
      expect(() =>
        requestOrder({
          vehicleType: VehicleType.MOTORCYCLE,
          cargo: Cargo.of({ category: CargoCategory.DOCUMENT, weightKg: 20 }),
        }),
      ).not.toThrow();
    });

    it('지난 시각으로는 예약할 수 없다', () => {
      expect(() => requestOrder({ scheduledPickupAt: NOW })).toThrow(
        InvalidArgumentError,
      );
      expect(
        requestOrder({ scheduledPickupAt: LATER }).snapshot().scheduledPickupAt,
      ).toEqual(LATER);
    });
  });

  describe('수락과 결제', () => {
    it('기사가 수락하면 결제하는 동안 잡아 두고, 결제되면 배차를 마친다', () => {
      const order = requestOrder();
      order.pullDomainEvents();

      order.reserveForPayment(DRIVER);
      expect(order.status).toBe(OrderStatus.PAYING);
      expect(eventNames(order)).toEqual([]);

      order.confirmAssignment(LATER);
      expect(order.snapshot()).toMatchObject({
        status: OrderStatus.ASSIGNED,
        driverId: DRIVER.id,
        assignedAt: LATER,
      });
      expect(order.wasCharged()).toBe(true);
      expect(eventNames(order)).toEqual(['order.assigned']);
    });

    it('결제가 안 되면 배차하지 않고 결제 실패로 둔다', () => {
      const order = requestOrder();
      order.pullDomainEvents();
      order.reserveForPayment(DRIVER);

      order.failPayment('LIMIT_EXCEEDED', LATER);

      expect(order.snapshot()).toMatchObject({
        status: OrderStatus.PAYMENT_FAILED,
        driverId: null,
        assignedAt: null,
        paymentFailureCode: 'LIMIT_EXCEEDED',
      });
      expect(order.wasCharged()).toBe(false);
      expect(eventNames(order)).toEqual(['order.payment-failed']);
    });

    it('결제가 안 된 주문은 다른 카드로 다시 요청하면 배차 대기로 돌아간다', () => {
      const order = requestOrder();
      order.reserveForPayment(DRIVER);
      order.failPayment('LIMIT_EXCEEDED', LATER);
      order.pullDomainEvents();

      order.retryPayment(CUSTOMER, 'card-2', LATER);

      expect(order.snapshot()).toMatchObject({
        status: OrderStatus.REQUESTED,
        paymentMethodId: 'card-2',
        paymentFailureCode: null,
        requestedAt: NOW,
      });
      expect(eventNames(order)).toEqual(['order.requested']);
    });

    it('결제 중이거나 이미 배차된 주문은 다른 기사가 수락할 수 없다', () => {
      const paying = requestOrder();
      paying.reserveForPayment(DRIVER);
      const assigned = assign(requestOrder());

      for (const order of [paying, assigned]) {
        expect(() =>
          order.reserveForPayment({ ...DRIVER, id: 'driver-2' }),
        ).toThrow(ConflictError);
        expect(order.driverId).toBe(DRIVER.id);
      }
    });

    it('요청한 차종이 아닌 기사는 수락할 수 없다', () => {
      const order = requestOrder();

      expect(() =>
        order.reserveForPayment({
          id: 'driver-2',
          vehicleType: VehicleType.LABO,
        }),
      ).toThrow(ConflictError);
      expect(order.status).toBe(OrderStatus.REQUESTED);
    });

    it('결제하는 동안에는 고객이 취소할 수 없고 기사도 진행할 수 없다', () => {
      const order = requestOrder();
      order.reserveForPayment(DRIVER);

      expect(() => order.cancelByCustomer(CUSTOMER, '', LATER)).toThrow(
        ConflictError,
      );
      expect(() => order.depart(DRIVER.id, LATER)).toThrow(ForbiddenError);
    });
  });

  describe('도착 예정 시각', () => {
    const PICKUP_ETA = new Date('2026-10-13T09:25:00Z');

    it('배차 전에는 어림할 근거가 없다', () => {
      expect(requestOrder().estimatedDeliveryAt).toBeNull();
    });

    it('기사 위치를 모른 채 배차되면 픽업 전까지 알 수 없다', () => {
      const order = assign(requestOrder());

      expect(order.snapshot().estimatedPickupAt).toBeNull();
      expect(order.estimatedDeliveryAt).toBeNull();
    });

    it('배차되면 픽업 예정 시각에 예상 소요 시간을 더한다', () => {
      const order = assign(requestOrder(), PICKUP_ETA);

      expect(order.estimatedDeliveryAt).toEqual(
        new Date('2026-10-13T10:05:00Z'),
      );
    });

    it('픽업한 뒤에는 실제 픽업 시각에서 다시 계산한다', () => {
      const order = assign(requestOrder(), PICKUP_ETA);
      order.pickUp(DRIVER.id, new Date('2026-10-13T09:30:00Z'));

      expect(order.estimatedDeliveryAt).toEqual(
        new Date('2026-10-13T10:10:00Z'),
      );
    });

    it('끝난 주문에는 도착 예정 시각이 없다', () => {
      const delivered = assign(requestOrder(), PICKUP_ETA);
      delivered.pickUp(DRIVER.id, LATER);
      delivered.deliver(DRIVER.id, LATER);
      const cancelled = assign(requestOrder(), PICKUP_ETA);
      cancelled.cancelByCustomer(CUSTOMER, '', LATER);

      expect(delivered.estimatedDeliveryAt).toBeNull();
      expect(cancelled.estimatedDeliveryAt).toBeNull();
    });
  });

  describe('진행: 출발 → 도착 → 픽업 → 배송 완료', () => {
    it('단계마다 시각을 남기고 이벤트를 낸다', () => {
      const order = assign(requestOrder());
      const departed = minutesAfter(LATER, 1);
      const arrived = minutesAfter(LATER, 15);
      const pickedUp = minutesAfter(arrived, 5);
      order.depart(DRIVER.id, departed);
      order.arrive(DRIVER.id, arrived);
      order.pickUp(DRIVER.id, pickedUp);
      order.deliver(DRIVER.id, minutesAfter(pickedUp, 40));

      expect(order.snapshot()).toMatchObject({
        status: OrderStatus.DELIVERED,
        departedAt: departed,
        arrivedAt: arrived,
        pickedUpAt: pickedUp,
        waitingMinutes: 5,
        waitingFee: Money.won(0),
      });
      expect(eventNames(order)).toEqual([
        'order.requested',
        'order.assigned',
        'order.departed',
        'order.arrived',
        'order.picked-up',
        'order.delivered',
      ]);
    });

    it('출발을 누르지 않고 도착하면 그때 출발한 것으로 본다', () => {
      const order = assign(requestOrder());
      order.arrive(DRIVER.id, LATER);

      expect(order.snapshot()).toMatchObject({
        status: OrderStatus.ARRIVED,
        departedAt: LATER,
        arrivedAt: LATER,
      });
    });

    it('픽업할 때 추가 요금과, 10분이 지난 대기 시간의 대기료가 붙는다', () => {
      const order = assign(requestOrder());
      order.arrive(DRIVER.id, LATER);
      order.pullDomainEvents();

      order.pickUp(DRIVER.id, minutesAfter(LATER, 14), {
        overload: 1,
        bulky: 0,
        stairs: 2,
      });

      expect(order.snapshot()).toMatchObject({
        extraItems: { overload: 1, bulky: 0, stairs: 2 },
        extraFee: Money.won(16000),
        waitingMinutes: 14,
        waitingFee: Money.won(2000),
      });
      expect(order.totalFare).toBe(28400 + 16000 + 2000);
      const [event] = order.pullDomainEvents();
      expect(event).toMatchObject({ additionalAmount: 18000 });
    });

    it('도착을 누르지 않고 픽업하면 기다린 시간이 없다', () => {
      const order = assign(requestOrder());
      order.pickUp(DRIVER.id, minutesAfter(LATER, 30));

      expect(order.snapshot()).toMatchObject({
        arrivedAt: minutesAfter(LATER, 30),
        waitingMinutes: 0,
      });
    });

    it('추가 요금의 수량은 0부터 30까지다', () => {
      const order = assign(requestOrder());

      expect(() =>
        order.pickUp(DRIVER.id, LATER, { overload: -1, bulky: 0, stairs: 0 }),
      ).toThrow(InvalidArgumentError);
      expect(order.status).toBe(OrderStatus.ASSIGNED);
    });

    it('픽업하지 않고 배송을 완료할 수 없다', () => {
      const order = assign(requestOrder());

      expect(() => order.deliver(DRIVER.id, LATER)).toThrow(ConflictError);
    });

    it('배차받지 않은 기사는 진행할 수 없다', () => {
      const order = assign(requestOrder());

      expect(() => order.pickUp('driver-2', LATER)).toThrow(ForbiddenError);
      expect(() => order.depart('driver-2', LATER)).toThrow(ForbiddenError);
      expect(order.status).toBe(OrderStatus.ASSIGNED);
    });

    it('이미 출발했으면 다시 출발할 수 없다', () => {
      const order = assign(requestOrder());
      order.depart(DRIVER.id, LATER);

      expect(() => order.depart(DRIVER.id, LATER)).toThrow(ConflictError);
    });
  });

  describe('reportNoShow', () => {
    it('도착하고 30분이 지나야 노쇼를 신고할 수 있다', () => {
      const order = assign(requestOrder());
      order.arrive(DRIVER.id, LATER);

      expect(() =>
        order.reportNoShow(DRIVER.id, minutesAfter(LATER, 29)),
      ).toThrow(ConflictError);
      order.pullDomainEvents();
      order.reportNoShow(DRIVER.id, minutesAfter(LATER, 30));

      expect(order.snapshot()).toMatchObject({
        status: OrderStatus.NO_SHOW,
        noShowAt: minutesAfter(LATER, 30),
        cancellationFee: Money.won(28400),
      });
      expect(order.cancellationFeeNow()).toBeNull();
      expect(eventNames(order)).toEqual(['order.no-show']);
    });

    it('도착하기 전에는 노쇼를 신고할 수 없다', () => {
      const order = assign(requestOrder());

      expect(() =>
        order.reportNoShow(DRIVER.id, minutesAfter(LATER, 60)),
      ).toThrow(ConflictError);
    });
  });

  describe('cancelByCustomer', () => {
    it('배차 전과 배차 후(픽업 전)에 취소할 수 있다', () => {
      const open = requestOrder();
      open.cancelByCustomer(CUSTOMER, ' 일정 변경 ', LATER);

      const assigned = assign(requestOrder());
      assigned.cancelByCustomer(CUSTOMER, '', LATER);

      expect(open.snapshot()).toMatchObject({
        status: OrderStatus.CANCELLED,
        cancelledAt: LATER,
        cancelReason: '일정 변경',
      });
      expect(assigned.snapshot()).toMatchObject({
        status: OrderStatus.CANCELLED,
        cancelReason: null,
      });
    });

    it('배차 전에 취소하면 결제한 것이 없어 돌려줄 것도 없다', () => {
      const order = requestOrder();
      expect(order.cancellationFeeNow()).toBe(0);

      order.cancelByCustomer(CUSTOMER, '', LATER);

      expect(order.refundDueOnCancel()).toBe(0);
    });

    it('기사가 출발하기 전에 취소하면 수수료 없이 모두 돌려준다', () => {
      const order = assign(requestOrder());
      expect(order.cancellationFeeNow()).toBe(0);
      order.pullDomainEvents();

      order.cancelByCustomer(CUSTOMER, '', LATER);

      expect(order.refundDueOnCancel()).toBe(28400);
      expect(order.pullDomainEvents()[0]).toMatchObject({
        cancellationFee: 0,
        refundAmount: 28400,
      });
    });

    it('기사가 출발한 뒤에는 요금의 15%(100원 단위)를 수수료로 빼고 돌려준다', () => {
      const order = assign(requestOrder());
      order.depart(DRIVER.id, LATER);
      expect(order.cancellationFeeNow()).toBe(4300);

      order.cancelByCustomer(CUSTOMER, '', LATER);

      expect(order.snapshot().cancellationFee).toEqual(Money.won(4300));
      expect(order.refundDueOnCancel()).toBe(24100);
    });

    it('도착한 뒤에 취소해도 15%다', () => {
      const order = assign(requestOrder());
      order.arrive(DRIVER.id, LATER);

      expect(order.cancellationFeeNow()).toBe(4300);
    });

    it('픽업한 뒤에는 취소할 수 없다', () => {
      const order = assign(requestOrder());
      order.pickUp(DRIVER.id, LATER);

      expect(() => order.cancelByCustomer(CUSTOMER, '변심', LATER)).toThrow(
        ConflictError,
      );
      expect(order.status).toBe(OrderStatus.PICKED_UP);
    });

    it('남의 주문은 취소할 수 없다', () => {
      expect(() =>
        requestOrder().cancelByCustomer('customer-2', '변심', LATER),
      ).toThrow(ForbiddenError);
    });
  });
});
