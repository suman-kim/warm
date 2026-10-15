import { InvalidArgumentError } from '../../../common/domain/domain-error.js';

/**
 * 비밀번호 규칙: 8~72자, 영문과 숫자를 모두 포함.
 * (72자는 bcrypt가 보는 길이의 한계다.)
 */
export function assertStrongPassword(password: string): void {
  if (
    password.length < 8 ||
    password.length > 72 ||
    !/[A-Za-z]/.test(password) ||
    !/\d/.test(password)
  ) {
    throw new InvalidArgumentError(
      'WEAK_PASSWORD',
      '비밀번호는 영문과 숫자를 포함해 8자 이상으로 만들어 주세요.',
    );
  }
}
