import { PasswordResetCode } from '../entities/password-reset-code.entity.js';

/** 비밀번호 재설정 코드 저장소 DI 토큰. */
export const PASSWORD_RESET_CODE_REPOSITORY = Symbol(
  'PASSWORD_RESET_CODE_REPOSITORY',
);

/** 비밀번호 재설정 코드 저장소 계약. */
export interface PasswordResetCodeRepository {
  /** 새 코드를 저장한다. 그 회원이 전에 받은 코드는 지운다. */
  replaceForUser(code: PasswordResetCode): Promise<void>;
  findByUserId(userId: string): Promise<PasswordResetCode | null>;
  /** 틀린 시도를 한 번 센다. */
  recordFailedAttempt(id: string): Promise<void>;
  markUsed(id: string, now: Date): Promise<void>;
}
