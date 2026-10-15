import { DomainEventPublisher } from '../../../../common/application/domain-event-publisher.port.js';
import { DomainEvent } from '../../../../common/domain/domain-event.js';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from '../../../../common/domain/domain-error.js';
import {
  ChargeKind,
  ChargeStatus,
} from '../../../payment/domain/entities/order-charge.entity.js';
import { CardType } from '../../../payment/domain/entities/payment-method.entity.js';
import { VehicleType } from '../../../../common/domain/vehicle-type.js';
import { Order } from '../../domain/entities/order.entity.js';
import { OrderStatus } from '../../domain/order-status.js';
import { OrderRepository } from '../../domain/repositories/order.repository.js';
import { Cargo, CargoCategory } from '../../domain/value-objects/cargo.js';
import { GeoPoint } from '../../domain/value-objects/geo-point.js';
import { Money } from '../../domain/value-objects/money.js';
import { Waypoint } from '../../domain/value-objects/waypoint.js';
import {
  DispatchDriver,
  DriverDirectory,
  DriverLocation,
} from '../ports/driver-directory.port.js';
import { ChargeAttempt, OrderPayments } from '../ports/order-payments.port.js';
import { RoutePlanner } from '../ports/route-planner.port.js';
import { SettlementPolicy } from '../../domain/services/settlement-policy.js';
import { DriverOrderTransition } from '../services/driver-order-transition.js';
import { AcceptOrderUseCase } from './accept-order.use-case.js';

const MINUTE_MS = 60_000;
const MINUTES_TO_PICKUP = 9;
const DRIVER: DispatchDriver = {
  id: 'driver-1',
  userId: 'user-1',
  name: '박기사',
  phone: '01033334444',
  vehicleType: VehicleType.DAMAS,
  vehicleNumber: '서울12가3456',
  canAcceptOrders: true,
};
const NEARBY: DriverLocation = {
  point: GeoPoint.of(37.51, 127.04),
  updatedAt: new Date(),
};

function openOrder(): Order {
  const waypoint = Waypoint.of({
    address: '서울 강남구 테헤란로 152',
    latitude: 37.5,
    longitude: 127.03,
    contactName: '홍길동',
    contactPhone: '01012345678',
  });
  const order = Order.request({
    id: 'order-1',
    customerId: 'customer-1',
    vehicleType: VehicleType.DAMAS,
    pickup: waypoint,
    dropoff: waypoint,
    cargo: Cargo.of({ category: CargoCategory.BOX, weightKg: 30 }),
    distanceKm: 12,
    durationMinutes: 40,
    baseFare: Money.won(28400),
    paymentMethodId: 'card-1',
    now: new Date(),
  });
  order.pullDomainEvents();
  return order;
}

const CARD = {
  paymentMethodId: 'card-1',
  brand: '신한카드',
  last4: '4821',
  type: CardType.CREDIT,
};
const PAID: ChargeAttempt = {
  ok: true,
  charge: {
    id: 'charge-1',
    kind: ChargeKind.DISPATCH,
    amount: 28400,
    status: ChargeStatus.PAID,
    card: CARD,
    approvalNumber: '30521877',
    approvedAt: new Date(),
    failureCode: null,
    failedAt: null,
    cancelledAmount: 0,
    cancelledAt: null,
  },
};
const DECLINED: ChargeAttempt = {
  ok: false,
  failureCode: 'LIMIT_EXCEEDED',
  charge: null,
};

function setup(
  driver: DispatchDriver | null,
  order: Order | null,
  location: DriverLocation | null = null,
  attempt: ChargeAttempt = PAID,
) {
  const saved: OrderStatus[] = [];
  const charged: { amount: number; paymentMethodId: string | null }[] = [];
  const published: DomainEvent[] = [];
  const planned: GeoPoint[][] = [];
  const orders = {
    findById: async () => order,
    save: async (o: Order) => void saved.push(o.status),
  } as Partial<OrderRepository> as OrderRepository;
  const drivers: DriverDirectory = {
    findByUserId: async () => driver,
    findById: async () => driver,
    findNames: async () => new Map(),
    findLocation: async () => location,
  };
  const publisher: DomainEventPublisher = {
    publishAll: async (events) => void published.push(...events),
  };
  const routePlanner: RoutePlanner = {
    plan: async (from, to) => {
      planned.push([from, to]);
      return {
        distanceKm: 3,
        durationMinutes: MINUTES_TO_PICKUP,
        path: [from, to],
      };
    },
  };
  const payments = {
    charge: async (input: {
      amount: number;
      paymentMethodId: string | null;
    }) => {
      charged.push({
        amount: input.amount,
        paymentMethodId: input.paymentMethodId,
      });
      return attempt;
    },
  } as Partial<OrderPayments> as OrderPayments;
  const policy = new SettlementPolicy(0, 5);
  const useCase = new AcceptOrderUseCase(
    new DriverOrderTransition(orders, drivers, publisher, policy),
    orders,
    drivers,
    routePlanner,
    payments,
    publisher,
    policy,
  );
  return { useCase, saved, published, planned, charged };
}

describe('AcceptOrderUseCase', () => {
  it('주문을 잡아 두고 고객의 카드로 결제한 뒤 배차한다', async () => {
    const { useCase, saved, published, charged } = setup(DRIVER, openOrder());

    const result = await useCase.execute(DRIVER.userId, 'order-1');

    expect(result).toMatchObject({
      status: OrderStatus.ASSIGNED,
      driverId: DRIVER.id,
    });
    // 결제하기 전에 한 번(결제 중), 결제한 뒤에 한 번(배차 완료) 저장한다.
    expect(saved).toEqual([OrderStatus.PAYING, OrderStatus.ASSIGNED]);
    expect(charged).toEqual([{ amount: 28400, paymentMethodId: 'card-1' }]);
    expect(published.map((event) => event.eventName)).toEqual([
      'order.assigned',
    ]);
  });

  it('결제가 안 되면 배차하지 않고 PAYMENT_DECLINED로 알린다', async () => {
    const order = openOrder();
    const { useCase, saved, published } = setup(DRIVER, order, null, DECLINED);

    await expect(useCase.execute(DRIVER.userId, 'order-1')).rejects.toThrow(
      ConflictError,
    );
    expect(saved).toEqual([OrderStatus.PAYING, OrderStatus.PAYMENT_FAILED]);
    expect(order.snapshot()).toMatchObject({
      driverId: null,
      paymentFailureCode: 'LIMIT_EXCEEDED',
    });
    expect(published.map((event) => event.eventName)).toEqual([
      'order.payment-failed',
    ]);
  });

  it('기사 위치를 알면 픽업지까지 걸리는 시간으로 픽업·도착 예정 시각을 남긴다', async () => {
    const order = openOrder();
    const { useCase, planned } = setup(DRIVER, order, NEARBY);

    const result = await useCase.execute(DRIVER.userId, 'order-1');

    const { assignedAt, pickup } = order.snapshot();
    expect(planned).toEqual([[NEARBY.point, pickup.point]]);
    expect(result.estimatedPickupAt).toEqual(
      new Date(assignedAt!.getTime() + MINUTES_TO_PICKUP * MINUTE_MS),
    );
    expect(result.estimatedDeliveryAt).toEqual(
      new Date(assignedAt!.getTime() + (MINUTES_TO_PICKUP + 40) * MINUTE_MS),
    );
  });

  it('기사 위치를 모르면 예정 시각 없이 배차한다', async () => {
    const { useCase, planned } = setup(DRIVER, openOrder());

    const result = await useCase.execute(DRIVER.userId, 'order-1');

    expect(planned).toEqual([]);
    expect(result.estimatedPickupAt).toBeNull();
    expect(result.estimatedDeliveryAt).toBeNull();
  });

  it('승인 전이거나 운행 중이 아닌 기사는 수락할 수 없다', async () => {
    const { useCase, saved, published, charged } = setup(
      { ...DRIVER, canAcceptOrders: false },
      openOrder(),
    );

    await expect(useCase.execute(DRIVER.userId, 'order-1')).rejects.toThrow(
      ForbiddenError,
    );
    expect(saved).toHaveLength(0);
    expect(charged).toHaveLength(0);
    expect(published).toHaveLength(0);
  });

  it('기사 등록을 하지 않은 회원은 수락할 수 없다', async () => {
    const { useCase } = setup(null, openOrder());

    await expect(useCase.execute('user-9', 'order-1')).rejects.toThrow(
      ForbiddenError,
    );
  });

  it('없는 주문이면 NotFoundError', async () => {
    const { useCase } = setup(DRIVER, null);

    await expect(useCase.execute(DRIVER.userId, 'order-9')).rejects.toThrow(
      NotFoundError,
    );
  });
});
