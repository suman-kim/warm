import { RefreshToken } from '../entities/refresh-token.entity.js';

/** 리프레시 토큰 저장소 DI 토큰. */
export const REFRESH_TOKEN_REPOSITORY = Symbol('REFRESH_TOKEN_REPOSITORY');

/** 리프레시 토큰 저장소 계약. */
export interface RefreshTokenRepository {
  save(token: RefreshToken): Promise<void>;
  findByHash(tokenHash: string): Promise<RefreshToken | null>;
  /**
   * 아직 폐기되지 않은 토큰을 폐기한다.
   * 이 호출이 실제로 폐기했으면 true — 같은 토큰으로 동시에 갱신해도 한 요청만 true를 받는다.
   */
  revokeByHash(tokenHash: string, now: Date): Promise<boolean>;
  /** 그 회원의 모든 기기를 로그아웃시킨다 (비밀번호 변경·탈퇴). */
  revokeAllByUser(userId: string, now: Date): Promise<void>;
}
