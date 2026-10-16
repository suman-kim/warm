import { InvalidArgumentError } from '../../../common/domain/domain-error.js';

/** 가게 정산 주기. */
export enum StoreSettlementCycle {
  /** 배달 완료일에서 N일 뒤에 그날 몫을 준다 */
  DAILY = 'DAILY',
  /** 한 주(월~일)의 몫을 다음 주의 정한 요일에 준다 */
  WEEKLY = 'WEEKLY',
}

/**
 * 주문앱(따끈)의 운영 정책. 아직 정하지 않은 값이 많아 운영자가 서버를 다시 배포하지 않고 바꿀 수 있게 DB에 둔다.
 * 주문에는 그때의 수수료율을 함께 남긴다 — 정책을 바꿔도 지난 주문의 정산은 바뀌지 않는다.
 */
export interface MarketplacePolicy {
  /** 중개수수료(%) — 메뉴 금액에 붙는다. 지자체 공모 자격은 2% 이하. */
  commissionRatePercent: number;
  /** 결제수수료 중 가게가 내는 몫(%) — 손님이 결제한 금액에 붙는다. 0이면 플랫폼이 낸다. */
  paymentFeeRatePercent: number;
  /** 손님이 가입할 때 휴대폰 인증을 받아야 하는지 */
  consumerPhoneVerificationRequired: boolean;
  storeSettlementCycle: StoreSettlementCycle;
  /** DAILY: 배달 완료일에서 며칠 뒤에 주는지 */
  storeSettlementDelayDays: number;
  /** WEEKLY: 지급 요일. 0 = 일요일 … 6 = 토요일 */
  storeSettlementPayoutWeekday: number;
  /** 결제한 주문을 가게가 이 분 안에 받지 않으면 운영자 관제에 '접수 지연'으로 보인다 */
  storeAcceptLateMinutes: number;
  /** 배달이 끝나고 리뷰를 쓸 수 있는 날 수 */
  reviewWindowDays: number;
}

/** 처음 값. TODO: 실제 수수료율·정산 주기는 정해지면 운영자 화면에서 바꾼다 (작업 36.1). */
export const DEFAULT_MARKETPLACE_POLICY: Readonly<MarketplacePolicy> = {
  commissionRatePercent: 2,
  paymentFeeRatePercent: 0,
  consumerPhoneVerificationRequired: true,
  storeSettlementCycle: StoreSettlementCycle.WEEKLY,
  storeSettlementDelayDays: 1,
  storeSettlementPayoutWeekday: 3,
  storeAcceptLateMinutes: 5,
  reviewWindowDays: 7,
};

/**
 * 정책 값을 확인한다. 저장된 값에 빠진 칸(새로 생긴 정책)이 있으면 처음 값으로 채운다.
 * 범위를 벗어나면 InvalidArgumentError.
 */
export function normalizeMarketplacePolicy(
  input: Partial<MarketplacePolicy>,
): MarketplacePolicy {
  const policy = { ...DEFAULT_MARKETPLACE_POLICY, ...input };
  rate(policy.commissionRatePercent, 30, '중개수수료');
  rate(policy.paymentFeeRatePercent, 10, '가게가 내는 결제수수료');
  if (typeof policy.consumerPhoneVerificationRequired !== 'boolean') {
    throw invalid('휴대폰 인증 여부는 true나 false로 정해 주세요.');
  }
  if (
    !Object.values(StoreSettlementCycle).includes(policy.storeSettlementCycle)
  ) {
    throw invalid('정산 주기는 DAILY나 WEEKLY로 정해 주세요.');
  }
  integer(policy.storeSettlementDelayDays, 0, 30, '정산 지연일');
  integer(policy.storeSettlementPayoutWeekday, 0, 6, '지급 요일');
  integer(policy.storeAcceptLateMinutes, 1, 60, '접수 지연 기준(분)');
  integer(policy.reviewWindowDays, 1, 90, '리뷰 기간(일)');
  return {
    commissionRatePercent: policy.commissionRatePercent,
    paymentFeeRatePercent: policy.paymentFeeRatePercent,
    consumerPhoneVerificationRequired: policy.consumerPhoneVerificationRequired,
    storeSettlementCycle: policy.storeSettlementCycle,
    storeSettlementDelayDays: policy.storeSettlementDelayDays,
    storeSettlementPayoutWeekday: policy.storeSettlementPayoutWeekday,
    storeAcceptLateMinutes: policy.storeAcceptLateMinutes,
    reviewWindowDays: policy.reviewWindowDays,
  };
}

function rate(value: number, max: number, label: string): void {
  // 소수 둘째 자리까지 (예: 1.5%, 3.25%).
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    value < 0 ||
    value > max ||
    Math.round(value * 100) !== value * 100
  ) {
    throw invalid(`${label}는 0~${max}% 사이, 소수 둘째 자리까지 정해 주세요.`);
  }
}

function integer(value: number, min: number, max: number, label: string): void {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw invalid(`${label}는 ${min}~${max} 사이의 정수로 정해 주세요.`);
  }
}

function invalid(message: string): InvalidArgumentError {
  return new InvalidArgumentError('INVALID_MARKETPLACE_POLICY', message);
}
