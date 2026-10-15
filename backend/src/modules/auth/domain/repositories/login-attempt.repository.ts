import { LoginAttempt } from '../entities/login-attempt.entity.js';

/** 로그인 실패 기록 저장소 DI 토큰. */
export const LOGIN_ATTEMPT_REPOSITORY = Symbol('LOGIN_ATTEMPT_REPOSITORY');

/** 로그인 실패 기록 저장소 계약. 이메일마다 한 줄. */
export interface LoginAttemptRepository {
  find(email: string): Promise<LoginAttempt | null>;
  save(attempt: LoginAttempt): Promise<void>;
  /** 로그인에 성공하면 지운다. */
  delete(email: string): Promise<void>;
}
