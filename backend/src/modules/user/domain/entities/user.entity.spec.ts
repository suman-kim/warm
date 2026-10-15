import {
  ConflictError,
  InvalidArgumentError,
} from '../../../../common/domain/domain-error.js';
import { PhoneNumber } from '../../../../common/domain/phone-number.js';
import { UserRole } from '../../../../common/domain/user-role.js';
import { UserStatus } from '../user-status.js';
import { Email } from '../value-objects/email.js';
import { Agreements, User } from './user.entity.js';

const NOW = new Date('2026-10-13T09:00:00Z');
const LATER = new Date('2026-10-14T09:00:00Z');
const AGREED: Agreements = { terms: true, privacy: true, marketing: false };

const register = (
  overrides: { role?: UserRole; agreements?: Agreements; name?: string } = {},
) =>
  User.register({
    id: 'user-1',
    email: Email.of('Hong@Example.com'),
    passwordHash: 'hash',
    name: ' 홍길동 ',
    phone: PhoneNumber.of('010-1234-5678'),
    role: UserRole.CUSTOMER,
    agreements: AGREED,
    now: NOW,
    ...overrides,
  });

describe('User', () => {
  describe('register', () => {
    it('활성 상태로 가입하고 약관에 동의한 시각을 남긴다', () => {
      expect(register().snapshot()).toMatchObject({
        name: '홍길동',
        status: UserStatus.ACTIVE,
        termsAgreedAt: NOW,
        privacyAgreedAt: NOW,
        marketingAgreedAt: null,
        withdrawnAt: null,
      });
    });

    it('마케팅 수신은 동의했을 때만 시각을 남긴다', () => {
      const user = register({ agreements: { ...AGREED, marketing: true } });

      expect(user.snapshot().marketingAgreedAt).toEqual(NOW);
    });

    it.each([
      { ...AGREED, terms: false },
      { ...AGREED, privacy: false },
    ])('필수 약관에 동의하지 않으면 가입할 수 없다 (%o)', (agreements) => {
      expect(() => register({ agreements })).toThrow(InvalidArgumentError);
    });

    it('운영자 계정은 가입으로 만들 수 없다', () => {
      expect(() => register({ role: UserRole.ADMIN })).toThrow(
        InvalidArgumentError,
      );
    });
  });

  describe('updateProfile', () => {
    it('준 항목만 바꾼다', () => {
      const user = register();

      user.updateProfile({ name: '홍길순' }, LATER);

      expect(user.name).toBe('홍길순');
      expect(user.phone).toBe('01012345678');
    });

    it('이름이 비면 거절한다', () => {
      expect(() => register().updateProfile({ name: '  ' }, LATER)).toThrow(
        InvalidArgumentError,
      );
    });

    it('마케팅 수신을 켜면 그 시각을, 끄면 null을 남긴다', () => {
      const user = register();

      user.updateProfile({ marketingAgreed: true }, LATER);
      expect(user.snapshot().marketingAgreedAt).toEqual(LATER);

      user.updateProfile({ marketingAgreed: false }, LATER);
      expect(user.snapshot().marketingAgreedAt).toBeNull();
    });

    it('이미 동의한 상태에서 다시 켜도 처음 동의한 시각을 지킨다', () => {
      const user = register({ agreements: { ...AGREED, marketing: true } });

      user.updateProfile({ marketingAgreed: true }, LATER);

      expect(user.snapshot().marketingAgreedAt).toEqual(NOW);
    });
  });

  describe('withdraw', () => {
    it('계정을 쓸 수 없게 하고 개인정보를 지운다', () => {
      const user = register({ agreements: { ...AGREED, marketing: true } });

      user.withdraw(LATER);

      expect(user.isActive()).toBe(false);
      expect(user.snapshot()).toMatchObject({
        status: UserStatus.WITHDRAWN,
        withdrawnAt: LATER,
        name: '탈퇴한 회원',
        passwordHash: '',
        marketingAgreedAt: null,
      });
      expect(user.phone).not.toContain('1234');
    });

    it('이메일을 비워 같은 이메일로 다시 가입할 수 있게 한다', () => {
      const user = register();

      user.withdraw(LATER);

      expect(user.email).toBe('withdrawn-user-1@withdrawn.invalid');
    });

    it('두 번 탈퇴할 수 없다', () => {
      const user = register();
      user.withdraw(LATER);

      expect(() => user.withdraw(LATER)).toThrow(ConflictError);
    });
  });
});
