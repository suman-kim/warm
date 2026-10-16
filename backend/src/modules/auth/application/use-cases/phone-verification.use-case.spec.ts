import { PhoneVerification } from '../../domain/entities/phone-verification.entity.js';
import { PhoneVerificationRepository } from '../../domain/repositories/phone-verification.repository.js';
import { PhoneVerificationUseCase } from './phone-verification.use-case.js';

/** 메모리 저장소. 엔티티는 읽기 전용이라 바뀐 값으로 새로 만들어 넣는다. */
function memoryRepository(): PhoneVerificationRepository {
  const rows: PhoneVerification[] = [];
  const replace = (id: string, change: Partial<PhoneVerification>) => {
    const index = rows.findIndex((row) => row.id === id);
    const row = rows[index];
    const next = { ...row, ...change };
    rows[index] = new PhoneVerification(
      next.id,
      next.phone,
      next.codeHash,
      next.expiresAt,
      next.attempts,
      next.verifiedAt,
      next.tokenHash,
      next.usedAt,
      next.createdAt,
    );
  };
  return {
    findLatestByPhone: async (phone) =>
      rows.filter((row) => row.phone === phone).at(-1) ?? null,
    findByTokenHash: async (tokenHash) =>
      rows.find((row) => row.tokenHash === tokenHash) ?? null,
    insert: async (verification) => void rows.push(verification),
    recordFailedAttempt: async (id) =>
      replace(id, {
        attempts: rows.find((row) => row.id === id)!.attempts + 1,
      }),
    markVerified: async (id, tokenHash, at) =>
      replace(id, { tokenHash, verifiedAt: at }),
    markUsed: async (id, at) => {
      if (rows.find((row) => row.id === id)!.usedAt) return false;
      replace(id, { usedAt: at });
      return true;
    },
  };
}

function setup() {
  const sent = new Map<string, string>();
  const useCase = new PhoneVerificationUseCase(memoryRepository(), {
    sendVerificationCode: async (phone, code) => void sent.set(phone, code),
  });
  return { useCase, sent };
}

describe('PhoneVerificationUseCase', () => {
  it('문자로 받은 코드를 맞히면 가입에 한 번 쓸 수 있는 토큰을 준다', async () => {
    const { useCase, sent } = setup();
    await useCase.request('010-1234-5678');
    const code = sent.get('01012345678')!;
    expect(code).toMatch(/^\d{6}$/);

    const { verificationToken } = await useCase.confirm('01012345678', code);
    await expect(
      useCase.consume(verificationToken, '010-1234-5678'),
    ).resolves.toBeUndefined();
    await expect(
      useCase.consume(verificationToken, '01012345678'),
    ).rejects.toMatchObject({ code: 'PHONE_VERIFICATION_REQUIRED' });
  });

  it('다른 번호의 토큰이나 토큰 없이는 가입할 수 없다', async () => {
    const { useCase, sent } = setup();
    await useCase.request('01012345678');
    const { verificationToken } = await useCase.confirm(
      '01012345678',
      sent.get('01012345678')!,
    );
    await expect(
      useCase.consume(verificationToken, '01099998888'),
    ).rejects.toMatchObject({ code: 'PHONE_VERIFICATION_REQUIRED' });
    await expect(
      useCase.consume(undefined, '01012345678'),
    ).rejects.toMatchObject({
      code: 'PHONE_VERIFICATION_REQUIRED',
    });
  });

  it('1분 안에 다시 받을 수 없고, 휴대폰 번호만 받는다', async () => {
    const { useCase } = setup();
    await useCase.request('01012345678');
    await expect(useCase.request('01012345678')).rejects.toMatchObject({
      code: 'PHONE_CODE_RECENTLY_SENT',
    });
    await expect(useCase.request('0255512345')).rejects.toMatchObject({
      code: 'INVALID_MOBILE_PHONE',
    });
  });

  it('다섯 번 틀리면 맞는 코드도 받지 않는다', async () => {
    const { useCase, sent } = setup();
    await useCase.request('01012345678');
    const code = sent.get('01012345678')!;
    const wrong = code === '000000' ? '111111' : '000000';
    for (let i = 0; i < 5; i++) {
      await expect(useCase.confirm('01012345678', wrong)).rejects.toMatchObject(
        {
          code: 'INVALID_PHONE_CODE',
        },
      );
    }
    await expect(useCase.confirm('01012345678', code)).rejects.toMatchObject({
      code: 'INVALID_PHONE_CODE',
    });
  });
});
