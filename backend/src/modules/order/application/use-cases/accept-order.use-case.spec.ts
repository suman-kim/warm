import { DomainEventPublisher } from '../../../../common/application/domain-event-publisher.port.js';
import { DomainEvent } from '../../../../common/domain/domain-event.js';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from '../../../../common/domain/domain-error.js';
import { VehicleType } from '../../../../common/domain/vehicle-type.js';
import { Order } from '../../domain/entities/order.entity.js';
import { OrderStatus } from '../../domain/order-status.js';
import { OrderRepository } from '../../domain/repositories/order.repository.js';
import { SettlementPolicy } from '../../domain/services/settlement-policy.js';
import { GeoPoint } from '../../domain/value-objects/geo-point.js';
import { Money } from '../../domain/value-objects/money.js';
import { DoorPayment } from '../../domain/value-objects/store-delivery.js';
import { Waypoint } from '../../domain/value-objects/waypoint.js';
import {
  DispatchDriver,
  DriverDirectory,
  DriverLocation,
} from '../ports/driver-directory.port.js';
import { RoutePlanner } from '../ports/route-planner.port.js';
import { DriverOrderTransition } from '../services/driver-order-transition.js';
import { AcceptOrderUseCase } from './accept-order.use-case.js';

const MINUTE_MS = 60_000;
const MINUTES_TO_STORE = 9;
const RIDER: DispatchDriver = {
  id: 'driver-1',
  userId: 'user-1',
  name: '김라이더',
  phone: '01048211024',
  vehicleType: VehicleType.MOTORCYCLE,
  vehicleNumber: '서울강남가1234',
  canAcceptOrders: true,
};
const NEARBY: DriverLocation = {
  point: GeoPoint.of(37.51, 127.04),
  updatedAt: new Date(),
};

function openDelivery(readyAt: Date | null = null): Order {
  const waypoint = (name: string) =>
    Waypoint.of({
      address: '서울 강남구 테헤란로 152',
      latitude: 37.5,
      longitude: 127.03,
      contactName: name,
      contactPhone: '025551234',
    });
  const order = Order.request({
    id: 'order-1',
    ownerUserId: 'owner-1',
    storeId: 'store-1',
    pickup: waypoint('모보치킨 역삼점'),
    dropoff: waypoint('손님'),
    distanceKm: 1.3,
    durationMinutes: 7,
    deliveryFee: Money.won(3500),
    foodAmount: 23000,
    doorPayment: DoorPayment.CASH,
    readyAt,
    now: new Date(),
  });
  order.pullDomainEvents();
  return order;
}

function setup(
  driver: DispatchDriver | null,
  order: Order | null,
  location: DriverLocation | null = null,
  active = 0,
) {
  const saved: OrderStatus[] = [];
  const published: DomainEvent[] = [];
  const planned: GeoPoint[][] = [];
  const orders = {
    findById: async () => order,
    countInProgressByDriver: async () => active,
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
        durationMinutes: MINUTES_TO_STORE,
        path: [from, to],
      };
    },
  };
  const policy = new SettlementPolicy(10, 5);
  const useCase = new AcceptOrderUseCase(
    new DriverOrderTransition(orders, drivers, publisher, policy),
    orders,
    drivers,
    routePlanner,
    publisher,
    policy,
  );
  return { useCase, saved, published, planned };
}

describe('AcceptOrderUseCase', () => {
  it('결제 없이 바로 배차하고 라이더 몫을 붙여 준다', async () => {
    const { useCase, saved, published } = setup(RIDER, openDelivery());

    const result = await useCase.execute(RIDER.userId, 'order-1');

    expect(result).toMatchObject({
      status: OrderStatus.ASSIGNED,
      driverId: RIDER.id,
      // 대행료 3,500원에서 수수료 10%(350원)를 뺀 금액
      earning: 3150,
    });
    expect(saved).toEqual([OrderStatus.ASSIGNED]);
    expect(published.map((event) => event.eventName)).toEqual([
      'order.assigned',
    ]);
  });

  it('라이더 위치를 알면 가게에 닿는 시각으로 픽업 예정을 남긴다', async () => {
    const order = openDelivery();
    const { useCase, planned } = setup(RIDER, order, NEARBY);

    const result = await useCase.execute(RIDER.userId, 'order-1');

    const { assignedAt, pickup } = order.snapshot();
    expect(planned).toEqual([[NEARBY.point, pickup.point]]);
    expect(result.estimatedPickupAt).toEqual(
      new Date(assignedAt!.getTime() + MINUTES_TO_STORE * MINUTE_MS),
    );
    expect(result.estimatedDeliveryAt).toEqual(
      new Date(assignedAt!.getTime() + (MINUTES_TO_STORE + 7) * MINUTE_MS),
    );
  });

  it('조리가 더 늦게 끝나면 조리 완료 시각이 픽업 예정이다', async () => {
    const readyAt = new Date(Date.now() + 30 * MINUTE_MS);
    const { useCase } = setup(RIDER, openDelivery(readyAt), NEARBY);

    const result = await useCase.execute(RIDER.userId, 'order-1');

    expect(result.estimatedPickupAt).toEqual(readyAt);
  });

  it('라이더 위치를 모르면 조리 완료 시각(없으면 없음)으로 둔다', async () => {
    const { useCase, planned } = setup(RIDER, openDelivery());

    const result = await useCase.execute(RIDER.userId, 'order-1');

    expect(planned).toEqual([]);
    expect(result.estimatedPickupAt).toBeNull();
  });

  it('이미 3건을 맡고 있으면 더 받지 않는다', async () => {
    const { useCase, saved } = setup(RIDER, openDelivery(), null, 3);

    await expect(useCase.execute(RIDER.userId, 'order-1')).rejects.toThrow(
      ConflictError,
    );
    expect(saved).toHaveLength(0);
  });

  it('승인 전이거나 운행 중이 아닌 라이더는 수락할 수 없다', async () => {
    const { useCase, saved, published } = setup(
      { ...RIDER, canAcceptOrders: false },
      openDelivery(),
    );

    await expect(useCase.execute(RIDER.userId, 'order-1')).rejects.toThrow(
      ForbiddenError,
    );
    expect(saved).toHaveLength(0);
    expect(published).toHaveLength(0);
  });

  it('라이더 등록을 하지 않은 회원은 수락할 수 없다', async () => {
    const { useCase } = setup(null, openDelivery());

    await expect(useCase.execute('user-9', 'order-1')).rejects.toThrow(
      ForbiddenError,
    );
  });

  it('없는 배달이면 NotFoundError', async () => {
    const { useCase } = setup(RIDER, null);

    await expect(useCase.execute(RIDER.userId, 'order-9')).rejects.toThrow(
      NotFoundError,
    );
  });
});
