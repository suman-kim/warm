/** 정산 상태. */
export type SettlementStatus =
  /** 지급 대기 */
  | 'WAITING'
  /** 지급 중 — 이체를 요청했고 결과를 기다린다 */
  | 'PAYING'
  /** 지급 완료 */
  | 'PAID'
  /** 지급 실패 — 다시 지급할 수 있다 */
  | 'FAILED'
  /** 보류 — 계좌가 없거나 본인 명의로 확인되지 않았다 */
  | 'HOLD';

/** 한 주 정산의 금액 */
export class SettlementAmountsResult {
  /** 완료한 배송 수 */
  trips: number;
  /** 운행 매출(원) — 완료한 배송의 최종 요금 합 */
  gross: number;
  /** 그중 추가 요금과 대기료(원) */
  extraFare: number;
  /** 수수료(원) */
  fee: number;
  /** 취소 보상(원) — 고객 취소·노쇼 수수료 중 기사의 몫 */
  compensation: number;
  /** 정산액(원) = 운행 매출 − 수수료 + 취소 보상 */
  net: number;
}

/** 기사 한 명의 한 주 정산. */
export class SettlementResult extends SettlementAmountsResult {
  driverId: string;
  driverName: string;
  bankName: string | null;
  maskedAccountNumber: string | null;
  status: SettlementStatus;
  /** 보류·실패 사유 */
  reason: string | null;
  /** 지급 완료 시각 */
  paidAt: Date | null;
}

/** 한 주의 정산. */
export class SettlementWeekResult {
  /** 주의 시작과 끝 (한국 날짜, 월요일·일요일) */
  weekStart: string;
  weekEnd: string;
  /** 지급 예정일 (한국 날짜) */
  payoutDate: string;
  /** 수수료율(%) */
  commissionPercent: number;
  /** 가장 최근에 끝난 주인지 (이다음 주는 아직 볼 수 없다) */
  latest: boolean;
  items: SettlementResult[];
  totals: {
    drivers: number;
    gross: number;
    fee: number;
    compensation: number;
    /** 아직 지급하지 않은 정산액의 합 */
    unpaidNet: number;
  };
}

/** 지급 처리 결과의 실패 한 건 */
export class PayoutFailureResult {
  driverId: string;
  driverName: string;
  reason: string;
}

/** 지급 처리 결과. */
export class PayoutBatchResult {
  /** 지급을 처리한 시각 */
  requestedAt: Date;
  /** 처리한 기사 수 */
  requested: number;
  /** 지급 완료 */
  paid: number;
  /** 결과를 기다리는 중 */
  processing: number;
  failures: PayoutFailureResult[];
  /** 처리한 뒤의 그 주 정산 */
  week: SettlementWeekResult;
}

/** 지급 내역의 한 줄. */
export class PayoutResult {
  id: string;
  paidAt: Date;
  driverName: string;
  weekStart: string;
  weekEnd: string;
  bankName: string;
  maskedAccountNumber: string;
  amount: number;
  /** 지급 결과 */
  status: 'REQUESTED' | 'PAID' | 'FAILED';
  failureReason: string | null;
  /** 지급 처리한 운영자의 이름 */
  paidByName: string | null;
}

export class PayoutPageResult {
  items: PayoutResult[];
  total: number;
  page: number;
  size: number;
}

/** 기사가 보는 한 주의 정산 */
export class DriverSettlementWeekResult extends SettlementAmountsResult {
  weekStart: string;
  weekEnd: string;
  /** 지급(예정)일 (한국 날짜) */
  payoutDate: string;
  /** 진행 중인 주(IN_PROGRESS)이거나 정산 상태 */
  status: SettlementStatus | 'IN_PROGRESS';
  /** 보류·실패 사유 */
  reason: string | null;
  /** 지급 완료 시각 */
  paidAt: Date | null;
  bankName: string | null;
  maskedAccountNumber: string | null;
}

/** 기사의 정산 내역 응답. */
export class DriverSettlementsResult {
  commissionPercent: number;
  /** 지급 요일. 0 = 일요일 … 6 = 토요일 */
  payoutWeekday: number;
  /** 정산 계좌. 등록하지 않았으면 null. */
  account: {
    bankName: string;
    maskedAccountNumber: string;
    verified: boolean;
    verificationFailureReason: string | null;
  } | null;
  /** 계좌가 없거나 확인되지 않아 정산이 보류되는지 */
  onHold: boolean;
  /** 이번 주 (진행 중) */
  current: DriverSettlementWeekResult;
  /** 지급 예정 (끝난 주 중 아직 지급하지 않은 것, 최근 주부터) */
  upcoming: DriverSettlementWeekResult[];
  /** 지급 완료 (최근 주부터) */
  paid: DriverSettlementWeekResult[];
}
