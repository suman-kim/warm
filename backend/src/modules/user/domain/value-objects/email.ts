import { InvalidArgumentError } from '../../../../common/domain/domain-error.js';

/** 이메일 값 객체. 앞뒤 공백을 떼고 소문자로 보관한다. */
export class Email {
  private constructor(readonly value: string) {}

  static of(raw: string): Email {
    const normalized = raw.trim().toLowerCase();
    if (
      normalized.length > 255 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)
    ) {
      throw new InvalidArgumentError(
        'INVALID_EMAIL',
        '이메일 형식이 올바르지 않아요.',
      );
    }
    return new Email(normalized);
  }
}
