import { PhoneVerification } from '../entities/phone-verification.entity.js';

/** 휴대폰 인증 저장소 DI 토큰. */
export const PHONE_VERIFICATION_REPOSITORY = Symbol(
  'PHONE_VERIFICATION_REPOSITORY',
);

export interface PhoneVerificationRepository {
  /** 번호의 가장 최근 인증. 없으면 null. */
  findLatestByPhone(phone: string): Promise<PhoneVerification | null>;
  findByTokenHash(tokenHash: string): Promise<PhoneVerification | null>;
  insert(verification: PhoneVerification): Promise<void>;
  recordFailedAttempt(id: string): Promise<void>;
  markVerified(id: string, tokenHash: string, at: Date): Promise<void>;
  /** 가입에 썼다. 이미 썼으면 false (동시에 두 번 쓰는 것을 막는다). */
  markUsed(id: string, at: Date): Promise<boolean>;
}
