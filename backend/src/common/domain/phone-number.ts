import { InvalidArgumentError } from './domain-error.js';

/** 국내 전화번호 값 객체. 하이픈·공백을 뺀 숫자만 보관한다. */
export class PhoneNumber {
  private constructor(readonly value: string) {}

  static of(raw: string): PhoneNumber {
    const digits = raw.replace(/[\s-]/g, '');
    // 02-123-4567(9자리) ~ 010-1234-5678(11자리)
    if (!/^0\d{8,10}$/.test(digits)) throw PhoneNumber.invalid();
    return new PhoneNumber(digits);
  }

  /**
   * 주문의 연락처. 일반 번호에 더해 배달앱 안심번호(0504-1234-5678, 12자리)도 받는다.
   */
  static contact(raw: string): PhoneNumber {
    const digits = raw.replace(/[\s-]/g, '');
    if (/^050\d{9}$/.test(digits)) return new PhoneNumber(digits);
    return PhoneNumber.of(digits);
  }

  private static invalid(): InvalidArgumentError {
    return new InvalidArgumentError(
      'INVALID_PHONE_NUMBER',
      '전화번호 형식이 올바르지 않아요.',
    );
  }
}
