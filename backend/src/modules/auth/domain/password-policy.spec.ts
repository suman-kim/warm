import { InvalidArgumentError } from '../../../common/domain/domain-error.js';
import { assertStrongPassword } from './password-policy.js';

describe('assertStrongPassword', () => {
  it.each(['password1', 'abcd1234', `a1${'x'.repeat(70)}`])(
    '영문과 숫자가 섞인 8~72자를 받는다 (%s)',
    (password) => {
      expect(() => assertStrongPassword(password)).not.toThrow();
    },
  );

  it.each([
    ['7자', 'abc1234'],
    ['숫자 없음', 'abcdefgh'],
    ['영문 없음', '12345678'],
    ['73자', `a1${'x'.repeat(71)}`],
  ])('%s 은 받지 않는다', (_why, password) => {
    expect(() => assertStrongPassword(password)).toThrow(InvalidArgumentError);
  });
});
