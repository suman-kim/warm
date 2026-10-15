import { InvalidArgumentError } from '../../../../common/domain/domain-error.js';

/** 카드 종류. */
export enum CardType {
  CREDIT = 'CREDIT',
  CHECK = 'CHECK',
}

/**
 * 고객이 등록한 카드. 카드 번호는 받지 않는다 — PG사가 준 빌링키로 결제한다.
 * 지우면 기록은 남기고(지난 결제의 영수증에 필요하다) 결제에는 쓰지 않는다.
 */
export class PaymentMethod {
  constructor(
    readonly id: string,
    readonly userId: string,
    /** PG사의 빌링키. 서버 밖으로 내보내지 않는다. */
    readonly billingKey: string,
    readonly cardBrand: string,
    readonly cardLast4: string,
    readonly cardType: CardType,
    private currentDefault: boolean,
    readonly createdAt: Date,
    private currentRemovedAt: Date | null,
  ) {
    if (!/^\d{4}$/.test(cardLast4)) {
      throw new InvalidArgumentError(
        'INVALID_CARD',
        '카드 정보가 올바르지 않아요.',
      );
    }
  }

  get isDefault(): boolean {
    return this.currentDefault;
  }

  get removedAt(): Date | null {
    return this.currentRemovedAt;
  }

  get isUsable(): boolean {
    return this.currentRemovedAt === null;
  }

  /** 신한카드 ••4821 */
  get label(): string {
    return `${this.cardBrand} ••${this.cardLast4}`;
  }

  markDefault(isDefault: boolean): void {
    this.currentDefault = isDefault;
  }

  remove(now: Date): void {
    this.currentRemovedAt ??= now;
    this.currentDefault = false;
  }
}
