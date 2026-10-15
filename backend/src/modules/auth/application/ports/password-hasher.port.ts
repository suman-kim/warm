/** 비밀번호 해시기 DI 토큰. */
export const PASSWORD_HASHER = Symbol('PASSWORD_HASHER');

/** 비밀번호 해시 포트. */
export interface PasswordHasher {
  hash(plain: string): Promise<string>;
  matches(plain: string, hash: string): Promise<boolean>;
}
