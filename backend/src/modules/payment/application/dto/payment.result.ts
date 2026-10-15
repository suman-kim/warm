import {
  CardType,
  PaymentMethod,
} from '../../domain/entities/payment-method.entity.js';
import { CardRegistrationSetup } from '../ports/payment-gateway.port.js';

/** 등록한 카드 */
export class PaymentMethodResult {
  id: string;
  /** 카드사 (예: 신한카드) */
  cardBrand: string;
  /** 카드 번호 끝 4자리 */
  cardLast4: string;
  cardType: CardType;
  isDefault: boolean;
  createdAt: Date;
}

/** 앱이 카드 등록 화면을 열 때 쓰는 값 */
export class CardRegistrationResult implements CardRegistrationSetup {
  /** DEV면 개발용 카드 등록 화면을, PORTONE이면 포트원 카드 등록 창을 띄운다. */
  provider: 'DEV' | 'PORTONE';
  /** 포트원 상점 ID. DEV면 null. */
  storeId: string | null;
  /** 포트원 채널 키 (어느 PG사로 카드를 등록할지). DEV면 null. */
  channelKey: string | null;
  /** PG사에 넘기는 고객 키 (회원마다 고정) */
  customerKey: string;
}

export function toPaymentMethodResult(
  method: PaymentMethod,
): PaymentMethodResult {
  return {
    id: method.id,
    cardBrand: method.cardBrand,
    cardLast4: method.cardLast4,
    cardType: method.cardType,
    isDefault: method.isDefault,
    createdAt: method.createdAt,
  };
}
