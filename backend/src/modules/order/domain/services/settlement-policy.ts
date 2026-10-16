import { InvalidArgumentError } from '../../../../common/domain/domain-error.js';
import {
  addDays,
  kstDayOfWeek,
  kstStartOfDay,
} from '../../../../common/domain/kst.js';
import { Period } from '../repositories/order.repository.js';

/**
 * 정산 정책 DI 토큰. 값은 서버 설정(COMMISSION_RATE_PERCENT, SETTLEMENT_PAYOUT_WEEKDAY,
 * DRIVER_CANCELLATION_SHARE_PERCENT)에서 온다.
 */
export const SETTLEMENT_POLICY = Symbol('SETTLEMENT_POLICY');

const MONDAY = 1;

/**
 * 정산 정책 (도메인 서비스).
 * 한 주(월~일)에 완료한 배달을 모아, 대행료에서 수수료를 뺀 금액을 그다음 주의 지급 요일에 준다.
 * 가게가 낸 취소 수수료 중 라이더에게 주는 몫(취소 보상)도 함께 준다 — 지금은 0%다(플랫폼이 갖는다).
 */
export class SettlementPolicy {
  constructor(
    /** 요금에서 떼는 수수료율(%) */
    readonly commissionPercent: number,
    /** 지급 요일. 0 = 일요일 … 6 = 토요일 */
    readonly payoutWeekday: number,
    /** 취소 수수료 중 라이더에게 주는 몫(%) */
    readonly driverCancellationSharePercent = 0,
  ) {
    if (!(commissionPercent >= 0 && commissionPercent < 100)) {
      throw new InvalidArgumentError(
        'INVALID_COMMISSION_RATE',
        '수수료율은 0 이상 100 미만이어야 해요.',
      );
    }
    if (
      !Number.isInteger(payoutWeekday) ||
      payoutWeekday < 0 ||
      payoutWeekday > 6
    ) {
      throw new InvalidArgumentError(
        'INVALID_PAYOUT_WEEKDAY',
        '지급 요일은 0(일)~6(토)이어야 해요.',
      );
    }
    if (!(
      driverCancellationSharePercent >= 0 &&
      driverCancellationSharePercent <= 100
    )) {
      throw new InvalidArgumentError(
        'INVALID_CANCELLATION_SHARE',
        '취소 보상 비율은 0~100이어야 해요.',
      );
    }
  }

  /** 배송 한 건의 수수료(원). 10원 단위로 반올림한다. */
  feeOf(fare: number): number {
    return Math.round((fare * this.commissionPercent) / 1000) * 10;
  }

  /** 배송 한 건에서 기사가 받는 금액(원) — 요금에서 수수료를 뺀 값. */
  earningOf(fare: number): number {
    return fare - this.feeOf(fare);
  }

  /** 가게가 낸 취소 수수료 중 라이더에게 주는 몫(원). 10원 단위로 반올림한다. */
  compensationOf(cancellationFee: number): number {
    return (
      Math.round(
        (cancellationFee * this.driverCancellationSharePercent) / 1000,
      ) * 10
    );
  }

  /** [weekStart]에 시작하는 주의 지급일 — 그 주가 끝난 뒤 처음 오는 지급 요일. */
  payoutDateOf(weekStart: Date): Date {
    const nextMonday = addDays(weekStart, 7);
    return addDays(nextMonday, (this.payoutWeekday - MONDAY + 7) % 7);
  }

  /** 지금 기준으로 다음에 돌아오는 지급과 그때 정산되는 주. 오늘이 지급일이면 오늘이다. */
  upcoming(now: Date): { payoutDate: Date; period: Period } {
    const thisWeek = weekStartOf(now);
    const lastWeek = addDays(thisWeek, -7);
    const pending = this.payoutDateOf(lastWeek);
    const weekStart = kstStartOfDay(now) <= pending ? lastWeek : thisWeek;
    return {
      payoutDate: this.payoutDateOf(weekStart),
      period: weekOf(weekStart),
    };
  }
}

/** 그 시각이 속한 주의 시작(한국 시간 월요일 0시). */
export function weekStartOf(at: Date): Date {
  return addDays(kstStartOfDay(at), -((kstDayOfWeek(at) - MONDAY + 7) % 7));
}

/** [weekStart]에 시작하는 한 주(월~일). */
export function weekOf(weekStart: Date): Period {
  return { from: weekStart, to: addDays(weekStart, 7) };
}
