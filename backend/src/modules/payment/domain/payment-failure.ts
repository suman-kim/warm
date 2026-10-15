/** 카드 결제가 안 된 사유. PG사의 오류를 이 몇 가지로 묶어 고객에게 안내한다. */
export enum PaymentFailureCode {
  LIMIT_EXCEEDED = 'LIMIT_EXCEEDED',
  INSUFFICIENT_BALANCE = 'INSUFFICIENT_BALANCE',
  CARD_SUSPENDED_OR_EXPIRED = 'CARD_SUSPENDED_OR_EXPIRED',
  ISSUER_MAINTENANCE = 'ISSUER_MAINTENANCE',
  AUTHENTICATION_REQUIRED = 'AUTHENTICATION_REQUIRED',
  /** 결제할 카드가 없다 (요청한 뒤 카드를 모두 지웠다) */
  NO_CARD = 'NO_CARD',
  UNKNOWN = 'UNKNOWN',
}

/** 사유마다 고객에게 보여 줄 제목과 해결 방법 (디자인의 문구). */
export const PAYMENT_FAILURE_GUIDE: Readonly<
  Record<PaymentFailureCode, { title: string; guidance: string }>
> = {
  [PaymentFailureCode.LIMIT_EXCEEDED]: {
    title: '한도 초과',
    guidance:
      '카드 한도가 부족해요. 카드사 앱에서 한도를 확인하거나 다른 카드로 결제해 주세요.',
  },
  [PaymentFailureCode.INSUFFICIENT_BALANCE]: {
    title: '잔액 부족',
    guidance:
      '체크카드 잔액이 부족해요. 잔액을 채우거나 다른 카드로 결제해 주세요.',
  },
  [PaymentFailureCode.CARD_SUSPENDED_OR_EXPIRED]: {
    title: '카드 정지·만료',
    guidance:
      '정지됐거나 유효기간이 지난 카드예요. 다른 카드로 결제하거나 새 카드를 등록해 주세요.',
  },
  [PaymentFailureCode.ISSUER_MAINTENANCE]: {
    title: '카드사 점검',
    guidance:
      '카드사 점검 시간이라 결제하지 못했어요. 잠시 뒤 다시 요청하거나 다른 카드로 결제해 주세요.',
  },
  [PaymentFailureCode.AUTHENTICATION_REQUIRED]: {
    title: '본인인증 필요',
    guidance:
      '카드사에서 본인인증을 요청했어요. 카드를 다시 등록해 본인인증을 마쳐 주세요.',
  },
  [PaymentFailureCode.NO_CARD]: {
    title: '등록한 카드 없음',
    guidance: '등록한 카드가 없어요. 카드를 등록하고 다시 요청해 주세요.',
  },
  [PaymentFailureCode.UNKNOWN]: {
    title: '알 수 없는 오류',
    guidance:
      '결제하지 못했어요. 잠시 뒤 다시 요청하거나 다른 카드로 결제해 주세요.',
  },
};

export function failureGuide(code: string | null): {
  code: PaymentFailureCode;
  title: string;
  guidance: string;
} | null {
  if (!code) {
    return null;
  }
  const known = (Object.values(PaymentFailureCode) as string[]).includes(code)
    ? (code as PaymentFailureCode)
    : PaymentFailureCode.UNKNOWN;
  return { code: known, ...PAYMENT_FAILURE_GUIDE[known] };
}
