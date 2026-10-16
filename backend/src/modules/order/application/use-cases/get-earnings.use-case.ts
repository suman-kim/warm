import { Inject, Injectable } from '@nestjs/common';
import { addDays, kstDateString } from '../../../../common/domain/kst.js';
import { OrderStatus } from '../../domain/order-status.js';
import {
  ORDER_REPOSITORY,
  type OrderRepository,
} from '../../domain/repositories/order.repository.js';
import {
  SETTLEMENT_POLICY,
  type SettlementPolicy,
} from '../../domain/services/settlement-policy.js';
import { driverEarningOf, EarningsResult } from '../dto/order.result.js';
import { DriverOrderTransition } from '../services/driver-order-transition.js';
import { toKstPeriod } from '../services/kst-period.js';

/**
 * 라이더 수입 조회 유스케이스. 기간의 날짜별 수입과 다음 정산 예정액을 준다.
 * 수입은 완료한 배달의 대행료에서 수수료를 뺀 금액과,
 * 가게 취소의 취소 보상(지금 정책은 0원)이다.
 */
@Injectable()
export class GetEarningsUseCase {
  constructor(
    @Inject(ORDER_REPOSITORY)
    private readonly orderRepository: OrderRepository,
    @Inject(SETTLEMENT_POLICY)
    private readonly policy: SettlementPolicy,
    private readonly transition: DriverOrderTransition,
  ) {}

  async execute(
    userId: string,
    from: string,
    to: string,
  ): Promise<EarningsResult> {
    const driver = await this.transition.requireDriver(userId);
    const period = toKstPeriod(from, to);
    const settlement = this.policy.upcoming(new Date());
    const [finished, toSettle] = await Promise.all([
      this.orderRepository.findFinishedByDriver(driver.id, period),
      this.orderRepository.findFinishedByDriver(driver.id, settlement.period),
    ]);

    const daily = new Map<
      string,
      { earnings: number; sales: number; completedCount: number }
    >();
    for (let day = period.from; day < period.to; day = addDays(day, 1)) {
      daily.set(kstDateString(day), {
        earnings: 0,
        sales: 0,
        completedCount: 0,
      });
    }
    let cancelledCount = 0;
    for (const order of finished) {
      const state = order.snapshot();
      const delivered = state.status === OrderStatus.DELIVERED;
      if (state.status === OrderStatus.CANCELLED) {
        cancelledCount += 1;
      }
      const finishedAt = state.deliveredAt ?? state.cancelledAt;
      const bucket = finishedAt && daily.get(kstDateString(finishedAt));
      if (bucket) {
        const earning = driverEarningOf(order, this.policy);
        bucket.earnings += earning;
        bucket.sales += delivered ? order.fare : earning;
        bucket.completedCount += delivered ? 1 : 0;
      }
    }

    const days = [...daily.entries()].map(([date, value]) => ({
      date,
      ...value,
    }));
    return {
      from,
      to,
      totalEarnings: days.reduce((sum, day) => sum + day.earnings, 0),
      totalSales: days.reduce((sum, day) => sum + day.sales, 0),
      completedCount: days.reduce((sum, day) => sum + day.completedCount, 0),
      cancelledCount,
      daily: days,
      nextSettlement: {
        date: kstDateString(settlement.payoutDate),
        amount: toSettle.reduce(
          (sum, order) => sum + driverEarningOf(order, this.policy),
          0,
        ),
      },
    };
  }
}
