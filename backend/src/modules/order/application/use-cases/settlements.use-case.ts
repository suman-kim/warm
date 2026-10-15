import { randomUUID } from 'node:crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  PageQuery,
  toPageRequest,
} from '../../../../common/application/page.js';
import {
  ConflictError,
  InvalidArgumentError,
} from '../../../../common/domain/domain-error.js';
import {
  addDays,
  kstDateString,
  parseKstDate,
} from '../../../../common/domain/kst.js';
import {
  USER_REPOSITORY,
  type UserRepository,
} from '../../../user/domain/repositories/user.repository.js';
import {
  Payout,
  PayoutAmounts,
  PayoutStatus,
} from '../../domain/entities/payout.entity.js';
import { OrderStatus } from '../../domain/order-status.js';
import {
  ORDER_REPOSITORY,
  type OrderRepository,
  type SettlementEntry,
} from '../../domain/repositories/order.repository.js';
import {
  PAYOUT_REPOSITORY,
  type PayoutRepository,
} from '../../domain/repositories/payout.repository.js';
import {
  SETTLEMENT_POLICY,
  SettlementPolicy,
  weekOf,
  weekStartOf,
} from '../../domain/services/settlement-policy.js';
import {
  DriverSettlementsResult,
  DriverSettlementWeekResult,
  PayoutBatchResult,
  PayoutPageResult,
  SettlementResult,
  SettlementStatus,
  SettlementWeekResult,
} from '../dto/settlement.result.js';
import {
  PAYEE_DIRECTORY,
  type Payee,
  type PayeeDirectory,
} from '../ports/payee-directory.port.js';
import {
  PAYOUT_GATEWAY,
  type PayoutGateway,
  type PayoutOutcome,
} from '../ports/payout-gateway.port.js';
import { DriverOrderTransition } from '../services/driver-order-transition.js';

/** 기사 앱의 정산 내역에 보여 줄 지난 주 수 */
const DRIVER_HISTORY_WEEKS = 8;

const NO_AMOUNTS: PayoutAmounts = {
  trips: 0,
  gross: 0,
  extraFare: 0,
  fee: 0,
  compensation: 0,
  net: 0,
};

/**
 * 정산 유스케이스. 운영자는 끝난 한 주의 기사별 정산액을 보고 지급 처리하고, 기사는 자기 정산 내역을 본다.
 * 정산액 = 완료한 배송의 최종 요금 − 수수료 + 취소 보상. 계좌가 없거나 본인 명의로 확인되지 않으면 보류한다.
 * 지급은 PAYOUT_GATEWAY가 한다 — 지금은 운영자가 직접 이체한 것을 기록하는 수동 구현이다.
 */
@Injectable()
export class SettlementsUseCase {
  private readonly logger = new Logger(SettlementsUseCase.name);

  constructor(
    @Inject(ORDER_REPOSITORY)
    private readonly orderRepository: OrderRepository,
    @Inject(PAYOUT_REPOSITORY)
    private readonly payoutRepository: PayoutRepository,
    @Inject(PAYEE_DIRECTORY)
    private readonly payeeDirectory: PayeeDirectory,
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepository,
    @Inject(PAYOUT_GATEWAY)
    private readonly payoutGateway: PayoutGateway,
    @Inject(SETTLEMENT_POLICY)
    private readonly policy: SettlementPolicy,
    private readonly transition: DriverOrderTransition,
  ) {}

  /** 한 주의 정산. [weekStart]를 주지 않으면 가장 최근에 끝난 주. */
  async week(weekStart?: string): Promise<SettlementWeekResult> {
    const now = new Date();
    return this.load(this.resolveWeek(weekStart, now), now);
  }

  /**
   * 지급 처리. 고른 기사가 모두 지급 대기나 지급 실패여야 한다.
   * 기사마다 이체를 요청하고 결과(완료·진행 중·실패)를 모아 돌려준다. 완료한 지급은 되돌릴 수 없다.
   */
  async pay(
    actorId: string,
    weekStart: string,
    driverIds: string[],
  ): Promise<PayoutBatchResult> {
    const now = new Date();
    const start = this.resolveWeek(weekStart, now);
    const week = await this.load(start, now);
    const targets = [...new Set(driverIds)].map((driverId) =>
      week.items.find((item) => item.driverId === driverId),
    );
    if (
      targets.some(
        (item) => item?.status !== 'WAITING' && item?.status !== 'FAILED',
      )
    ) {
      throw new ConflictError(
        'SETTLEMENT_NOT_PAYABLE',
        '지급 대기나 지급 실패가 아닌 정산이 있어요. 목록을 새로 고쳐 주세요.',
      );
    }
    const items = targets as SettlementResult[];
    const payouts = items.map(
      (item) =>
        new Payout(
          randomUUID(),
          item.driverId,
          start,
          {
            trips: item.trips,
            gross: item.gross,
            extraFare: item.extraFare,
            fee: item.fee,
            compensation: item.compensation,
            net: item.net,
          },
          item.bankName!,
          item.maskedAccountNumber!,
          now,
          actorId,
        ),
    );
    await this.payoutRepository.saveAll(payouts);

    const failures: PayoutBatchResult['failures'] = [];
    for (const [index, payout] of payouts.entries()) {
      const outcome = await this.payoutGateway
        .transfer({
          payoutId: payout.id,
          driverId: payout.driverId,
          amount: payout.net,
          bankName: payout.bankName,
        })
        .catch((error: unknown): PayoutOutcome => {
          this.logger.error(`지급 요청 실패 (${payout.id})`, error);
          return { status: 'FAILED', reason: '이체를 요청하지 못했어요' };
        });
      if (outcome.status === 'PAID') {
        payout.complete(new Date());
      } else if (outcome.status === 'FAILED') {
        payout.fail(outcome.reason, new Date());
        failures.push({
          driverId: payout.driverId,
          driverName: items[index].driverName,
          reason: outcome.reason,
        });
      }
      await this.payoutRepository.update(payout);
    }
    return {
      requestedAt: now,
      requested: payouts.length,
      paid: payouts.filter((payout) => payout.status === PayoutStatus.PAID)
        .length,
      processing: payouts.filter(
        (payout) => payout.status === PayoutStatus.REQUESTED,
      ).length,
      failures,
      week: await this.load(start, new Date()),
    };
  }

  /** 지급 내역 (최근에 처리한 것부터, 실패 포함). */
  async payouts(page: PageQuery): Promise<PayoutPageResult> {
    const { items, total } = await this.payoutRepository.findPage(
      toPageRequest(page),
    );
    const [payees, admins] = await Promise.all([
      this.payeeDirectory.findByDriverIds([
        ...new Set(items.map((payout) => payout.driverId)),
      ]),
      this.userRepository.findByIds([
        ...new Set(items.map((payout) => payout.paidBy)),
      ]),
    ]);
    const payeeName = new Map(payees.map((each) => [each.driverId, each.name]));
    const adminName = new Map(admins.map((user) => [user.id, user.name]));
    return {
      items: items.map((payout) => ({
        id: payout.id,
        paidAt: payout.paidAt,
        driverName: payeeName.get(payout.driverId) ?? '',
        weekStart: kstDateString(payout.weekStart),
        weekEnd: kstDateString(addDays(payout.weekStart, 6)),
        bankName: payout.bankName,
        maskedAccountNumber: payout.maskedAccountNumber,
        amount: payout.net,
        status: payout.status,
        failureReason: payout.failureReason,
        paidByName: adminName.get(payout.paidBy) ?? null,
      })),
      total,
      page: page.page,
      size: page.size,
    };
  }

  /**
   * 기사의 정산 내역: 이번 주(진행 중), 지급 예정(끝났지만 아직 지급하지 않은 주), 지급 완료.
   * 계좌가 없거나 본인 명의로 확인되지 않으면 onHold이고 지급 예정 주가 보류로 보인다.
   */
  async forDriver(userId: string): Promise<DriverSettlementsResult> {
    const driver = await this.transition.requireDriver(userId);
    const now = new Date();
    const thisWeek = weekStartOf(now);
    const firstWeek = addDays(thisWeek, -7 * DRIVER_HISTORY_WEEKS);
    const [entries, payouts, [payee]] = await Promise.all([
      this.orderRepository.findSettlementEntries(
        { from: firstWeek, to: addDays(thisWeek, 7) },
        driver.id,
      ),
      this.payoutRepository.findByDriver(driver.id, DRIVER_HISTORY_WEEKS * 3),
      this.payeeDirectory.findByDriverIds([driver.id]),
    ]);
    const byWeek = new Map<number, SettlementEntry[]>();
    for (const entry of entries) {
      const week = weekStartOf(entry.finishedAt).getTime();
      byWeek.set(week, [...(byWeek.get(week) ?? []), entry]);
    }
    const amountsOf = (weekStart: Date) =>
      sumAmounts(byWeek.get(weekStart.getTime()) ?? [], this.policy).get(
        driver.id,
      ) ?? NO_AMOUNTS;
    const weekResult = (
      weekStart: Date,
      amounts: PayoutAmounts,
      status: DriverSettlementWeekResult['status'],
      extra: Partial<DriverSettlementWeekResult> = {},
    ): DriverSettlementWeekResult => ({
      weekStart: kstDateString(weekStart),
      weekEnd: kstDateString(addDays(weekStart, 6)),
      payoutDate: kstDateString(this.policy.payoutDateOf(weekStart)),
      ...amounts,
      status,
      reason: null,
      paidAt: null,
      bankName: payee?.bankName ?? null,
      maskedAccountNumber: payee?.maskedAccountNumber ?? null,
      ...extra,
    });

    const paid = payouts
      .filter((payout) => payout.status === PayoutStatus.PAID)
      .map((payout) =>
        weekResult(payout.weekStart, payout.amounts, 'PAID', {
          paidAt: payout.completedAt ?? payout.paidAt,
          bankName: payout.bankName,
          maskedAccountNumber: payout.maskedAccountNumber,
        }),
      );
    const upcoming: DriverSettlementWeekResult[] = [];
    for (
      let week = addDays(thisWeek, -7);
      week >= firstWeek;
      week = addDays(week, -7)
    ) {
      const forWeek = payouts.filter(
        (payout) => payout.weekStart.getTime() === week.getTime(),
      );
      if (forWeek.some((payout) => payout.status === PayoutStatus.PAID)) {
        continue;
      }
      const processing = forWeek.find(
        (payout) => payout.status === PayoutStatus.REQUESTED,
      );
      if (processing) {
        upcoming.push(weekResult(week, processing.amounts, 'PAYING'));
        continue;
      }
      const amounts = amountsOf(week);
      if (amounts.net === 0) {
        continue;
      }
      const { status, reason } = settlementStatusOf(
        payee,
        forWeek.at(-1) ?? null,
      );
      upcoming.push(weekResult(week, amounts, status, { reason }));
    }
    return {
      commissionPercent: this.policy.commissionPercent,
      payoutWeekday: this.policy.payoutWeekday,
      account: payee?.bankName
        ? {
            bankName: payee.bankName,
            maskedAccountNumber: payee.maskedAccountNumber!,
            verified: payee.accountVerified,
            verificationFailureReason: payee.verificationFailureReason,
          }
        : null,
      onHold: !payee?.bankName || !payee.accountVerified,
      current: weekResult(thisWeek, amountsOf(thisWeek), 'IN_PROGRESS'),
      upcoming,
      paid,
    };
  }

  private async load(start: Date, now: Date): Promise<SettlementWeekResult> {
    const [entries, payouts] = await Promise.all([
      this.orderRepository.findSettlementEntries(weekOf(start)),
      this.payoutRepository.findByWeek(start),
    ]);
    const sums = sumAmounts(entries, this.policy);
    // 지급 완료·진행 중이 있으면 그것을, 없으면 마지막 실패를 본다.
    const payoutByDriver = new Map<string, Payout>();
    for (const payout of payouts) {
      const current = payoutByDriver.get(payout.driverId);
      if (!current || current.status === PayoutStatus.FAILED) {
        payoutByDriver.set(payout.driverId, payout);
      }
    }
    const payees = await this.payeeDirectory.findByDriverIds([
      ...new Set([...sums.keys(), ...payoutByDriver.keys()]),
    ]);

    const items: SettlementResult[] = payees
      .map((payee): SettlementResult => {
        const payout = payoutByDriver.get(payee.driverId) ?? null;
        // 지급했거나 지급 중인 정산은 그때 적어 둔 금액과 계좌를 그대로 보여 준다.
        if (payout && payout.status !== PayoutStatus.FAILED) {
          return {
            driverId: payee.driverId,
            driverName: payee.name,
            bankName: payout.bankName,
            maskedAccountNumber: payout.maskedAccountNumber,
            ...payout.amounts,
            status: payout.status === PayoutStatus.PAID ? 'PAID' : 'PAYING',
            reason: null,
            paidAt: payout.completedAt,
          };
        }
        const { status, reason } = settlementStatusOf(payee, payout);
        return {
          driverId: payee.driverId,
          driverName: payee.name,
          bankName: payee.bankName,
          maskedAccountNumber: payee.maskedAccountNumber,
          ...(sums.get(payee.driverId) ?? NO_AMOUNTS),
          status,
          reason,
          paidAt: null,
        };
      })
      .filter((item) => item.net > 0 || item.status === 'PAID')
      .sort(
        (a, b) => b.gross - a.gross || a.driverName.localeCompare(b.driverName),
      );

    const sumOf = (pick: (item: SettlementResult) => number) =>
      items.reduce((total, item) => total + pick(item), 0);
    return {
      weekStart: kstDateString(start),
      weekEnd: kstDateString(addDays(start, 6)),
      payoutDate: kstDateString(this.policy.payoutDateOf(start)),
      commissionPercent: this.policy.commissionPercent,
      latest: start.getTime() === latestFinishedWeek(now).getTime(),
      items,
      totals: {
        drivers: items.length,
        gross: sumOf((item) => item.gross),
        fee: sumOf((item) => item.fee),
        compensation: sumOf((item) => item.compensation),
        unpaidNet: sumOf((item) => (item.status === 'PAID' ? 0 : item.net)),
      },
    };
  }

  /** 주의 시작을 확인한다. 월요일이어야 하고, 이미 끝난 주여야 한다. */
  private resolveWeek(weekStart: string | undefined, now: Date): Date {
    const latest = latestFinishedWeek(now);
    if (weekStart === undefined) {
      return latest;
    }
    const start = parseKstDate(weekStart);
    if (!start || weekStartOf(start).getTime() !== start.getTime()) {
      throw new InvalidArgumentError(
        'INVALID_WEEK',
        '주의 시작은 월요일 날짜(YYYY-MM-DD)로 보내 주세요.',
      );
    }
    if (start > latest) {
      throw new InvalidArgumentError(
        'WEEK_NOT_FINISHED',
        '아직 끝나지 않은 주는 정산할 수 없어요.',
      );
    }
    return start;
  }
}

function latestFinishedWeek(now: Date): Date {
  return addDays(weekStartOf(now), -7);
}

/** 기사별로 정산 금액을 모은다. */
function sumAmounts(
  entries: SettlementEntry[],
  policy: SettlementPolicy,
): Map<string, PayoutAmounts> {
  const sums = new Map<string, PayoutAmounts>();
  for (const entry of entries) {
    const sum = { ...(sums.get(entry.driverId) ?? NO_AMOUNTS) };
    if (entry.status === OrderStatus.DELIVERED) {
      sum.trips += 1;
      sum.gross += entry.totalFare;
      sum.extraFare += entry.extraFare;
      sum.fee += policy.feeOf(entry.totalFare);
    } else {
      sum.compensation += policy.compensationOf(entry.cancellationFee);
    }
    sum.net = sum.gross - sum.fee + sum.compensation;
    sums.set(entry.driverId, sum);
  }
  return sums;
}

/** 아직 지급하지 않은 정산의 상태: 계좌가 확인되지 않았으면 보류, 앞선 지급이 실패했으면 실패, 아니면 대기. */
function settlementStatusOf(
  payee: Payee | undefined,
  lastPayout: Payout | null,
): { status: SettlementStatus; reason: string | null } {
  if (!payee?.bankName) {
    return { status: 'HOLD', reason: '정산 계좌를 등록하지 않았어요' };
  }
  if (!payee.accountVerified) {
    return {
      status: 'HOLD',
      reason: payee.verificationFailureReason ?? '계좌 본인 확인 전이에요',
    };
  }
  if (lastPayout?.status === PayoutStatus.FAILED) {
    return { status: 'FAILED', reason: lastPayout.failureReason };
  }
  return { status: 'WAITING', reason: null };
}
