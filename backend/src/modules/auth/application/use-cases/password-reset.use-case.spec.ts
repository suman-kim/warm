import { InvalidArgumentError } from '../../../../common/domain/domain-error.js';
import { PhoneNumber } from '../../../../common/domain/phone-number.js';
import { UserRole } from '../../../../common/domain/user-role.js';
import { User } from '../../../user/domain/entities/user.entity.js';
import { UserRepository } from '../../../user/domain/repositories/user.repository.js';
import { Email } from '../../../user/domain/value-objects/email.js';
import {
  PasswordResetCode,
  RESET_CODE_MAX_ATTEMPTS,
  RESET_CODE_RESEND_INTERVAL_MS,
} from '../../domain/entities/password-reset-code.entity.js';
import { PasswordResetCodeRepository } from '../../domain/repositories/password-reset-code.repository.js';
import { RefreshTokenRepository } from '../../domain/repositories/refresh-token.repository.js';
import { PasswordHasher } from '../ports/password-hasher.port.js';
import { PasswordResetUseCase } from './password-reset.use-case.js';

const EMAIL = 'hong@example.com';
const NEW_PASSWORD = 'newpass123';

function activeUser(): User {
  return User.register({
    id: 'user-1',
    email: Email.of(EMAIL),
    passwordHash: 'hashed:oldpass123',
    name: '홍길동',
    phone: PhoneNumber.of('01012345678'),
    role: UserRole.CUSTOMER,
    agreements: { terms: true, privacy: true, marketing: false },
    now: new Date(),
  });
}

function setup(user: User | null = activeUser()) {
  let stored: PasswordResetCode | null = null;
  const mails: { email: string; code: string }[] = [];
  const revoked: string[] = [];
  const users = {
    findByEmail: async (email: string) =>
      user && user.email === email ? user : null,
    save: async () => undefined,
  } as Partial<UserRepository> as UserRepository;
  const codes: PasswordResetCodeRepository = {
    replaceForUser: async (code) => void (stored = code),
    findByUserId: async () => stored,
    recordFailedAttempt: async () => {
      const code = stored!;
      stored = new PasswordResetCode(
        code.id,
        code.userId,
        code.codeHash,
        code.expiresAt,
        code.attempts + 1,
        code.usedAt,
        code.createdAt,
      );
    },
    markUsed: async (_id, now) => {
      const code = stored!;
      stored = new PasswordResetCode(
        code.id,
        code.userId,
        code.codeHash,
        code.expiresAt,
        code.attempts,
        now,
        code.createdAt,
      );
    },
  };
  const refreshTokens = {
    revokeAllByUser: async (userId: string) => void revoked.push(userId),
  } as Partial<RefreshTokenRepository> as RefreshTokenRepository;
  const hasher: PasswordHasher = {
    hash: async (plain) => `hashed:${plain}`,
    matches: async (plain, hash) => hash === `hashed:${plain}`,
  };
  const useCase = new PasswordResetUseCase(
    users,
    codes,
    refreshTokens,
    hasher,
    {
      send: async (email, code) => void mails.push({ email, code }),
    },
  );
  return {
    useCase,
    user,
    mails,
    revoked,
    stored: () => stored,
    /** 저장된 코드를 만료시킨다. */
    expire: () => {
      const code = stored!;
      stored = new PasswordResetCode(
        code.id,
        code.userId,
        code.codeHash,
        new Date(Date.now() - 1000),
        code.attempts,
        code.usedAt,
        code.createdAt,
      );
    },
  };
}

const wrongCodeFor = (code: string) =>
  code === '000000' ? '000001' : '000000';

describe('PasswordResetUseCase', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-13T09:00:00Z'));
  });
  afterEach(() => vi.useRealTimers());

  it('6자리 코드를 메일로 보내고, 원문 대신 해시만 저장한다', async () => {
    const { useCase, mails, stored } = setup();

    await useCase.request(' Hong@Example.com ');

    expect(mails).toHaveLength(1);
    expect(mails[0].email).toBe(EMAIL);
    expect(mails[0].code).toMatch(/^\d{6}$/);
    expect(stored()!.codeHash).not.toContain(mails[0].code);
  });

  it('가입하지 않은 이메일이어도 똑같이 성공하고, 아무것도 보내지 않는다', async () => {
    const { useCase, mails, stored } = setup();

    await expect(
      useCase.request('nobody@example.com'),
    ).resolves.toBeUndefined();

    expect(mails).toEqual([]);
    expect(stored()).toBeNull();
  });

  it('코드가 맞으면 비밀번호를 바꾸고 모든 기기를 로그아웃시킨다', async () => {
    const { useCase, user, mails, revoked, stored } = setup();
    await useCase.request(EMAIL);

    await useCase.confirm(EMAIL, mails[0].code, NEW_PASSWORD);

    expect(user!.passwordHash).toBe(`hashed:${NEW_PASSWORD}`);
    expect(revoked).toEqual(['user-1']);
    expect(stored()!.usedAt).not.toBeNull();
  });

  it('한 번 쓴 코드는 다시 쓸 수 없다', async () => {
    const { useCase, mails } = setup();
    await useCase.request(EMAIL);
    await useCase.confirm(EMAIL, mails[0].code, NEW_PASSWORD);

    await expect(
      useCase.confirm(EMAIL, mails[0].code, 'another123'),
    ).rejects.toThrow(InvalidArgumentError);
  });

  it('틀린 코드는 거절하고 비밀번호를 그대로 둔다', async () => {
    const { useCase, user, mails, stored } = setup();
    await useCase.request(EMAIL);

    await expect(
      useCase.confirm(EMAIL, wrongCodeFor(mails[0].code), NEW_PASSWORD),
    ).rejects.toMatchObject({ code: 'INVALID_RESET_CODE' });

    expect(user!.passwordHash).toBe('hashed:oldpass123');
    expect(stored()!.attempts).toBe(1);
  });

  it('다섯 번 틀리면 맞는 코드도 받지 않는다 — 코드를 새로 받아야 한다', async () => {
    const { useCase, user, mails } = setup();
    await useCase.request(EMAIL);
    const wrong = wrongCodeFor(mails[0].code);
    for (let i = 0; i < RESET_CODE_MAX_ATTEMPTS; i += 1) {
      await expect(useCase.confirm(EMAIL, wrong, NEW_PASSWORD)).rejects.toThrow(
        InvalidArgumentError,
      );
    }

    await expect(
      useCase.confirm(EMAIL, mails[0].code, NEW_PASSWORD),
    ).rejects.toThrow(InvalidArgumentError);
    expect(user!.passwordHash).toBe('hashed:oldpass123');
  });

  it('만료된 코드는 받지 않는다', async () => {
    const { useCase, mails, expire } = setup();
    await useCase.request(EMAIL);
    expire();

    await expect(
      useCase.confirm(EMAIL, mails[0].code, NEW_PASSWORD),
    ).rejects.toThrow(InvalidArgumentError);
  });

  it('1분 안에 다시 요청하면 새로 보내지 않고, 앞서 받은 코드를 그대로 쓴다', async () => {
    const { useCase, mails } = setup();
    await useCase.request(EMAIL);
    vi.advanceTimersByTime(RESET_CODE_RESEND_INTERVAL_MS - 1);

    await useCase.request(EMAIL);

    expect(mails).toHaveLength(1);
    await expect(
      useCase.confirm(EMAIL, mails[0].code, NEW_PASSWORD),
    ).resolves.toBeUndefined();
  });

  it('코드를 다시 받으면 앞의 코드는 못 쓴다', async () => {
    const { useCase, mails } = setup();
    await useCase.request(EMAIL);
    vi.advanceTimersByTime(RESET_CODE_RESEND_INTERVAL_MS);
    await useCase.request(EMAIL);
    const [first, second] = mails.map((mail) => mail.code);
    if (first === second) {
      return; // 백만 분의 일로 같은 코드가 나오면 구분할 수 없다.
    }

    await expect(useCase.confirm(EMAIL, first, NEW_PASSWORD)).rejects.toThrow(
      InvalidArgumentError,
    );
    await expect(
      useCase.confirm(EMAIL, second, NEW_PASSWORD),
    ).resolves.toBeUndefined();
  });

  it('약한 새 비밀번호는 코드를 확인하기 전에 거절한다', async () => {
    const { useCase, mails, stored } = setup();
    await useCase.request(EMAIL);

    await expect(
      useCase.confirm(EMAIL, mails[0].code, 'short'),
    ).rejects.toMatchObject({ code: 'WEAK_PASSWORD' });
    expect(stored()!.usedAt).toBeNull();
  });

  it('탈퇴한 회원에게는 코드를 보내지 않는다', async () => {
    const user = activeUser();
    const { useCase, mails } = setup(user);
    user.withdraw(new Date());

    await useCase.request(EMAIL);

    expect(mails).toEqual([]);
  });
});
