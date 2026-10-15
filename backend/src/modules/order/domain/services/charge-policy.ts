import { InvalidArgumentError } from '../../../../common/domain/domain-error.js';

/** 고객이 고르는 운반 도움. */
export enum LoadingHelp {
  /** 고객이 직접 옮긴다 */
  NONE = 'NONE',
  /** 기사와 함께 옮긴다 */
  TOGETHER = 'TOGETHER',
  /** 기사가 혼자 옮긴다 */
  DRIVER_ONLY = 'DRIVER_ONLY',
}

/** 픽업지·도착지의 층과 엘리베이터. 엘리베이터가 없으면 2층부터 계단 요금이 붙는다. */
export interface FloorAccess {
  floor: number;
  elevator: boolean;
}

/** 기사가 픽업지에서 넣는 추가 요금의 수량. */
export interface ExtraItems {
  /** 과적 — 기준 무게를 넘은 단계 */
  overload: number;
  /** 부피가 큰 짐의 개수 */
  bulky: number;
  /** 엘리베이터 없이 오른 층 */
  stairs: number;
}

export const NO_EXTRA_ITEMS: Readonly<ExtraItems> = {
  overload: 0,
  bulky: 0,
  stairs: 0,
};

export const GROUND_FLOOR: Readonly<FloorAccess> = { floor: 1, elevator: true };

// TODO: 관리자 웹·앱 디자인(프로토타입)의 값이다. 요금 정책이 정해지면 바꾼다 (작업 16).
const RULES = {
  helpFee: {
    [LoadingHelp.NONE]: 0,
    [LoadingHelp.TOGETHER]: 10_000,
    [LoadingHelp.DRIVER_ONLY]: 20_000,
  },
  stairFeePerFloor: 3_000,
  extraUnitPrice: { overload: 10_000, bulky: 10_000, stairs: 3_000 },
  freeWaitingMinutes: 10,
  waitingFeePerMinute: 500,
  cancellationFeePercent: 15,
  noShowWaitMinutes: 30,
} as const;

const MAX_FLOOR = 99;
const MAX_EXTRA_QUANTITY = 30;
const MINUTE_MS = 60_000;

/**
 * 요금에 붙는 것들의 규칙 (도메인 서비스): 운반 도움, 계단, 기사가 넣는 추가 요금,
 * 대기료, 취소 수수료, 노쇼. 기본 요금은 FarePolicy가 정한다.
 */
export class ChargePolicy {
  /** 앱이 안내 화면에 그대로 보여 줄 값들. */
  static readonly rules = RULES;

  static helpFee(help: LoadingHelp): number {
    return RULES.helpFee[help];
  }

  /** 엘리베이터가 없는 곳의 계단 요금 — 2층부터 한 층에 얼마. */
  static stairFee(pickup: FloorAccess, dropoff: FloorAccess): number {
    const floors = (access: FloorAccess) =>
      access.elevator ? 0 : Math.max(0, access.floor - 1);
    return (floors(pickup) + floors(dropoff)) * RULES.stairFeePerFloor;
  }

  static extraFee(items: ExtraItems): number {
    return (
      items.overload * RULES.extraUnitPrice.overload +
      items.bulky * RULES.extraUnitPrice.bulky +
      items.stairs * RULES.extraUnitPrice.stairs
    );
  }

  /** 기사가 도착한 뒤 [until]까지 기다린 시간(분, 내림). */
  static waitingMinutes(arrivedAt: Date, until: Date): number {
    return Math.max(
      0,
      Math.floor((until.getTime() - arrivedAt.getTime()) / MINUTE_MS),
    );
  }

  /** 대기료 — 무료 시간이 지난 뒤 1분마다. */
  static waitingFee(minutes: number): number {
    return (
      Math.max(0, minutes - RULES.freeWaitingMinutes) *
      RULES.waitingFeePerMinute
    );
  }

  /** 기사가 출발한 뒤 취소할 때의 수수료. 100원 단위로 반올림한다. */
  static cancellationFee(fare: number): number {
    return Math.round((fare * RULES.cancellationFeePercent) / 100 / 100) * 100;
  }

  /** 기사가 도착하고 노쇼를 신고할 수 있을 만큼 기다렸는지. */
  static canReportNoShow(arrivedAt: Date, now: Date): boolean {
    return (
      now.getTime() - arrivedAt.getTime() >= RULES.noShowWaitMinutes * MINUTE_MS
    );
  }

  /** 노쇼를 신고할 수 있게 되는 시각. */
  static noShowAvailableAt(arrivedAt: Date): Date {
    return new Date(arrivedAt.getTime() + RULES.noShowWaitMinutes * MINUTE_MS);
  }

  static assertFloorAccess(access: FloorAccess): void {
    if (
      !Number.isInteger(access.floor) ||
      access.floor < 1 ||
      access.floor > MAX_FLOOR
    ) {
      throw new InvalidArgumentError(
        'INVALID_FLOOR',
        `층은 1층부터 ${MAX_FLOOR}층까지 넣을 수 있어요.`,
      );
    }
  }

  static assertExtraItems(items: ExtraItems): void {
    for (const count of [items.overload, items.bulky, items.stairs]) {
      if (!Number.isInteger(count) || count < 0 || count > MAX_EXTRA_QUANTITY) {
        throw new InvalidArgumentError(
          'INVALID_EXTRA_ITEMS',
          `추가 요금의 수량은 0부터 ${MAX_EXTRA_QUANTITY}까지예요.`,
        );
      }
    }
  }
}
