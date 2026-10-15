import { InvalidArgumentError } from '../../../../common/domain/domain-error.js';

/** 금액 값 객체. 원(KRW) 단위 정수만 다룬다. */
export class Money {
  private constructor(readonly amount: number) {}

  static won(amount: number): Money {
    if (!Number.isInteger(amount) || amount < 0) {
      throw new InvalidArgumentError(
        'INVALID_AMOUNT',
        '금액이 올바르지 않아요.',
      );
    }
    return new Money(amount);
  }
}
