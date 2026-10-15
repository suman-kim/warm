import { ConflictError } from '../../../../common/domain/domain-error.js';
import {
  ChargeKind,
  ChargeStatus,
  OrderCharge,
} from './order-charge.entity.js';
import { CardType } from './payment-method.entity.js';

const NOW = new Date('2026-10-14T05:00:00Z');
const CARD = {
  paymentMethodId: 'card-1',
  brand: '신한카드',
  last4: '4821',
  type: CardType.CREDIT,
};

function paid(amount = 44000): OrderCharge {
  return OrderCharge.paid({
    id: 'charge-1',
    orderId: 'order-1',
    customerId: 'customer-1',
    kind: ChargeKind.DISPATCH,
    amount,
    card: CARD,
    paymentKey: 'pay-1',
    approvalNumber: '30521877',
    approvedAt: NOW,
  });
}

describe('OrderCharge', () => {
  it('일부를 돌려주면 일부 취소, 모두 돌려주면 취소가 된다', () => {
    const charge = paid();

    charge.cancel(6600, NOW);
    expect(charge.status).toBe(ChargeStatus.PARTIALLY_CANCELLED);
    expect(charge.remainingAmount).toBe(37400);

    charge.cancel(37400, NOW);
    expect(charge.status).toBe(ChargeStatus.CANCELLED);
    expect(charge.remainingAmount).toBe(0);
    expect(charge.isPaid).toBe(false);
  });

  it('결제된 금액보다 많이 돌려줄 수 없다', () => {
    const charge = paid();

    expect(() => charge.cancel(44001, NOW)).toThrow(ConflictError);
    expect(() => charge.cancel(0, NOW)).toThrow(ConflictError);
  });

  it('실패한 결제는 돌려줄 것이 없다', () => {
    const failed = OrderCharge.failed({
      id: 'charge-2',
      orderId: 'order-1',
      customerId: 'customer-1',
      kind: ChargeKind.DISPATCH,
      amount: 44000,
      card: CARD,
      failureCode: 'LIMIT_EXCEEDED',
      now: NOW,
    });

    expect(failed.isPaid).toBe(false);
    expect(failed.remainingAmount).toBe(0);
    expect(() => failed.cancel(1000, NOW)).toThrow(ConflictError);
  });
});
