import {
  ConflictError,
  InvalidArgumentError,
  NotFoundError,
} from '../../../../common/domain/domain-error.js';
import { VehicleType } from '../../../../common/domain/vehicle-type.js';
import { Cargo, CargoCategory } from '../value-objects/cargo.js';
import { Money } from '../value-objects/money.js';
import { Waypoint } from '../value-objects/waypoint.js';
import { Order } from './order.entity.js';
import { Review, ReviewTag } from './review.entity.js';

const NOW = new Date('2026-10-13T09:00:00Z');
const CUSTOMER = 'customer-1';
const DRIVER = { id: 'driver-1', vehicleType: VehicleType.DAMAS };

function order(progress: 'requested' | 'assigned' | 'delivered'): Order {
  const waypoint = Waypoint.of({
    address: '서울 강남구 테헤란로 152',
    latitude: 37.5,
    longitude: 127.03,
    contactName: '홍길동',
    contactPhone: '01012345678',
  });
  const created = Order.request({
    id: 'order-1',
    customerId: CUSTOMER,
    vehicleType: VehicleType.DAMAS,
    pickup: waypoint,
    dropoff: waypoint,
    cargo: Cargo.of({ category: CargoCategory.BOX, weightKg: 30 }),
    distanceKm: 12,
    durationMinutes: 40,
    baseFare: Money.won(28400),
    paymentMethodId: 'card-1',
    now: NOW,
  });
  if (progress !== 'requested') {
    created.reserveForPayment(DRIVER);
    created.confirmAssignment(NOW);
  }
  if (progress === 'delivered') {
    created.pickUp(DRIVER.id, NOW);
    created.deliver(DRIVER.id, NOW);
  }
  return created;
}

const write = (overrides: Partial<Parameters<typeof Review.write>[0]> = {}) =>
  Review.write({
    id: 'review-1',
    order: order('delivered'),
    customerId: CUSTOMER,
    rating: 5,
    now: NOW,
    ...overrides,
  });

describe('Review', () => {
  it('배송이 끝난 주문에 고객이 기사를 평가한다', () => {
    const review = write({
      tags: [ReviewTag.KIND, ReviewTag.FAST],
      comment: ' 조심히 옮겨 주셨어요 ',
    });

    expect(review).toMatchObject({
      orderId: 'order-1',
      customerId: CUSTOMER,
      driverId: DRIVER.id,
      rating: 5,
      tags: [ReviewTag.KIND, ReviewTag.FAST],
      comment: '조심히 옮겨 주셨어요',
    });
  });

  it('같은 태그를 여러 번 골라도 한 번만 남는다', () => {
    expect(write({ tags: [ReviewTag.KIND, ReviewTag.KIND] }).tags).toEqual([
      ReviewTag.KIND,
    ]);
  });

  it('태그와 내용은 없어도 된다', () => {
    expect(write({ comment: '   ' })).toMatchObject({
      tags: [],
      comment: null,
    });
  });

  it('배송이 끝나기 전에는 평가할 수 없다', () => {
    expect(() => write({ order: order('assigned') })).toThrow(ConflictError);
  });

  it('남의 주문이나 배차된 적 없는 주문은 없는 주문처럼 답한다', () => {
    expect(() => write({ customerId: 'customer-2' })).toThrow(NotFoundError);
    expect(() => write({ order: order('requested') })).toThrow(NotFoundError);
  });

  it.each([0, 6, 4.5, Number.NaN])('별점 %s 는 받지 않는다', (rating) => {
    expect(() => write({ rating })).toThrow(InvalidArgumentError);
  });

  it('내용은 300자까지 쓸 수 있다', () => {
    expect(() => write({ comment: '가'.repeat(300) })).not.toThrow();
    expect(() => write({ comment: '가'.repeat(301) })).toThrow(
      InvalidArgumentError,
    );
  });
});
