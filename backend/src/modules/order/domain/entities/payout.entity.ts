/** 지급 상태. */
export enum PayoutStatus {
  /** 지급을 요청했고 결과를 기다린다 */
  REQUESTED = 'REQUESTED',
  PAID = 'PAID',
  /** 보내지 못했다 — 사유를 고친 뒤 다시 지급할 수 있다 */
  FAILED = 'FAILED',
}

/** 지급할 때의 정산 내역. 지급한 뒤에는 바꾸지 않는다. */
export interface PayoutAmounts {
  /** 완료한 배달 수 */
  trips: number;
  /** 운행 매출 — 완료한 배달의 대행료 합 */
  gross: number;
  fee: number;
  /** 취소 보상 — 가게 취소 수수료 중 라이더의 몫 */
  compensation: number;
  /** 지급할 금액 = 운행 매출 − 수수료 + 취소 보상 */
  net: number;
}

/**
 * 정산 지급 기록. 운영자가 한 주의 정산액을 기사에게 보낸 것이다.
 * 기사 한 명의 한 주에 지급 완료(또는 진행 중)는 하나뿐이고, 실패한 지급은 기록으로 남긴 채 다시 지급할 수 있다.
 * 지급할 때의 금액과 계좌를 그대로 적어 둔다.
 */
export class Payout {
  constructor(
    readonly id: string,
    readonly driverId: string,
    /** 정산한 주의 시작 (한국 시간 월요일 0시) */
    readonly weekStart: Date,
    readonly amounts: PayoutAmounts,
    readonly bankName: string,
    readonly maskedAccountNumber: string,
    /** 지급을 처리(요청)한 시각 */
    readonly paidAt: Date,
    /** 지급 처리한 운영자 (회원 ID) */
    readonly paidBy: string,
    private currentStatus: PayoutStatus = PayoutStatus.REQUESTED,
    private currentFailureReason: string | null = null,
    private currentCompletedAt: Date | null = null,
  ) {}

  get status(): PayoutStatus {
    return this.currentStatus;
  }

  get failureReason(): string | null {
    return this.currentFailureReason;
  }

  /** 보냈거나 보내지 못한 것이 확인된 시각 */
  get completedAt(): Date | null {
    return this.currentCompletedAt;
  }

  get net(): number {
    return this.amounts.net;
  }

  complete(at: Date): void {
    this.currentStatus = PayoutStatus.PAID;
    this.currentFailureReason = null;
    this.currentCompletedAt = at;
  }

  fail(reason: string, at: Date): void {
    this.currentStatus = PayoutStatus.FAILED;
    this.currentFailureReason = reason;
    this.currentCompletedAt = at;
  }
}
