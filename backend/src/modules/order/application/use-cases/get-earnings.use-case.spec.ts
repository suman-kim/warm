import { ForbiddenError } from '../../../../common/domain/domain-error.js';
import { VehicleType } from '../../../../common/domain/vehicle-type.js';
import { Order } from '../../domain/entities/order.entity.js';
import {
  OrderRepository,
  Period,
} from '../../domain/repositories/order.repository.js';
import { SettlementPolicy } from '../../domain/services/settlement-policy.js';
import { Money } from '../../domain/value-objects/money.js';
import { DoorPayment } from '../../domain/value-objects/store-delivery.js';
import { Waypoint } from '../../domain/value-objects/waypoint.js';
import {
  DispatchDriver,
  DriverDirectory,
} from '../ports/driver-directory.port.js';
import { DriverOrderTransition } from '../services/driver-order-transition.js';
import { GetEarningsUseCase } from './get-earnings.use-case.js';

const DRIVER: DispatchDriver = {
  id: 'driver-1',
  userId: 'user-1',
  name: '박기사',
  phone: '01033334444',
  vehicleType: VehicleType.MOTORCYCLE,
  vehicleNumber: '서울강남가1234',
  canAcceptOrders: false,
};
// 고정한 '지금': 2026-10-13(화) 정오 KST → 금요일 지급이면 다음 정산은 10-16(금), 대상은 10-05 ~ 10-11.
const NOW = new Date('2026-10-13T12:00:00+09:00');
/** 수수료 없이 금요일에 지급하는 정책. 수수료 계산은 settlement-policy.spec.ts에서 본다. */
const NO_FEE_ON_FRIDAY = new SettlementPolicy(0, 5);

let sequence = 0;
function finishedOrder(
  fare: number,
  finishedAt: string,
  outcome: 'delivered' | 'cancelled' = 'delivered',
): Order {
  const at = new Date(finishedAt);
  const waypoint = Waypoint.of({
    address: '서울 강남구 테헤란로 152',
    latitude: 37.5,
    longitude: 127.03,
    contactName: '홍길동',
    contactPhone: '01012345678',
  });
  const order = Order.request({
    id: `order-${(sequence += 1)}`,
    ownerUserId: 'customer-1',
    storeId: 'store-1',
    pickup: waypoint,
    dropoff: waypoint,
    distanceKm: 1.3,
    durationMinutes: 7,
    deliveryFee: Money.won(fare),
    foodAmount: 0,
    doorPayment: DoorPayment.PREPAID,
    readyAt: null,
    now: at,
  });
  order.assign(DRIVER.id, at);
  if (outcome === 'cancelled') {
    order.cancelByCustomer('customer-1', '', at);
  } else {
    order.pickUp(DRIVER.id, at);
    order.deliver(DRIVER.id, at);
  }
  return order;
}

function setup(
  orders: Order[],
  driver: DispatchDriver | null = DRIVER,
  policy = NO_FEE_ON_FRIDAY,
) {
  const asked: Period[] = [];
  const finishedAt = (order: Order) =>
    order.snapshot().deliveredAt ?? order.snapshot().cancelledAt!;
  const repository = {
    findFinishedByDriver: async (_driverId: string, period: Period) => {
      asked.push(period);
      return orders.filter(
        (order) =>
          finishedAt(order) >= period.from && finishedAt(order) < period.to,
      );
    },
  } as Partial<OrderRepository> as OrderRepository;
  const drivers = {
    findByUserId: async () => driver,
  } as Partial<DriverDirectory> as DriverDirectory;
  return {
    useCase: new GetEarningsUseCase(
      repository,
      policy,
      new DriverOrderTransition(
        repository,
        drivers,
        { publishAll: async () => undefined },
        policy,
      ),
    ),
    asked,
  };
}

describe('GetEarningsUseCase', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => vi.useRealTimers());

  it('기간의 모든 날짜를 수입 0원으로라도 채워서 준다', async () => {
    const { useCase } = setup([]);

    const result = await useCase.execute('user-1', '2026-10-12', '2026-10-14');

    expect(result.daily).toEqual([
      { date: '2026-10-12', earnings: 0, sales: 0, completedCount: 0 },
      { date: '2026-10-13', earnings: 0, sales: 0, completedCount: 0 },
      { date: '2026-10-14', earnings: 0, sales: 0, completedCount: 0 },
    ]);
    expect(result).toMatchObject({
      totalEarnings: 0,
      completedCount: 0,
      cancelledCount: 0,
    });
  });

  it('완료한 배달의 대행료를 한국 날짜별로 더한다', async () => {
    const { useCase } = setup([
      finishedOrder(28400, '2026-10-12T10:00:00+09:00'),
      finishedOrder(12000, '2026-10-12T23:59:00+09:00'),
      // UTC로는 10-12지만 한국은 이미 10-13이다.
      finishedOrder(9000, '2026-10-13T00:30:00+09:00'),
    ]);

    const result = await useCase.execute('user-1', '2026-10-12', '2026-10-13');

    expect(result.daily).toEqual([
      { date: '2026-10-12', earnings: 40400, sales: 40400, completedCount: 2 },
      { date: '2026-10-13', earnings: 9000, sales: 9000, completedCount: 1 },
    ]);
    expect(result.totalEarnings).toBe(49400);
    expect(result.completedCount).toBe(3);
  });

  it('취소된 배달은 수입에 넣지 않고 건수만 센다', async () => {
    const { useCase } = setup([
      finishedOrder(28400, '2026-10-12T10:00:00+09:00'),
      finishedOrder(50000, '2026-10-12T11:00:00+09:00', 'cancelled'),
    ]);

    const result = await useCase.execute('user-1', '2026-10-12', '2026-10-12');

    expect(result).toMatchObject({
      totalEarnings: 28400,
      completedCount: 1,
      cancelledCount: 1,
    });
  });

  it('다음 정산 예정액은 조회 기간과 상관없이 지난주에 완료한 배달이다', async () => {
    const { useCase, asked } = setup([
      finishedOrder(30000, '2026-10-05T09:00:00+09:00'),
      finishedOrder(20000, '2026-10-11T22:00:00+09:00'),
      finishedOrder(70000, '2026-10-08T09:00:00+09:00', 'cancelled'),
      // 이번 주에 완료한 것은 다음 주 금요일에 정산된다.
      finishedOrder(15000, '2026-10-12T09:00:00+09:00'),
    ]);

    const result = await useCase.execute('user-1', '2026-10-12', '2026-10-13');

    expect(result.nextSettlement).toEqual({
      date: '2026-10-16',
      amount: 50000,
    });
    expect(asked).toContainEqual({
      from: new Date('2026-10-05T00:00:00+09:00'),
      to: new Date('2026-10-12T00:00:00+09:00'),
    });
  });

  it('기사 등록을 하지 않은 회원은 볼 수 없다', async () => {
    const { useCase } = setup([], null);

    await expect(
      useCase.execute('user-9', '2026-10-12', '2026-10-13'),
    ).rejects.toThrow(ForbiddenError);
  });
  it('수수료를 떼는 정책이면 수입과 정산 예정액이 수수료를 뺀 금액이다', async () => {
    // 10% 수수료, 화요일 지급 → 오늘(10-13 화)이 지급일이고 대상은 10-05 ~ 10-11.
    const { useCase } = setup(
      [
        finishedOrder(28000, '2026-10-08T10:00:00+09:00'),
        finishedOrder(12000, '2026-10-13T09:00:00+09:00'),
      ],
      DRIVER,
      new SettlementPolicy(10, 2),
    );

    const result = await useCase.execute('user-1', '2026-10-13', '2026-10-13');

    // 매출(sales)은 수수료를 빼기 전 금액이다.
    expect(result.daily).toEqual([
      { date: '2026-10-13', earnings: 10800, sales: 12000, completedCount: 1 },
    ]);
    expect(result.totalSales).toBe(12000);
    expect(result.nextSettlement).toEqual({
      date: '2026-10-13',
      amount: 25200,
    });
  });
});
