import { UserRole } from '../../../../common/domain/user-role.js';

/** 토큰 서비스 DI 토큰. */
export const TOKEN_SERVICE = Symbol('TOKEN_SERVICE');

export interface AccessTokenClaims {
  /** 회원 ID */
  sub: string;
  role: UserRole;
}

export interface IssuedRefreshToken {
  /** 클라이언트에 내려주는 원문. 서버는 저장하지 않는다. */
  token: string;
  tokenHash: string;
  expiresAt: Date;
}

/** 액세스·리프레시 토큰 발급과 검증 포트. */
export interface TokenService {
  signAccessToken(claims: AccessTokenClaims): Promise<string>;
  /** 서명과 만료를 검증한다. 유효하지 않으면 null. */
  verifyAccessToken(token: string): Promise<AccessTokenClaims | null>;
  issueRefreshToken(now: Date): IssuedRefreshToken;
  hashRefreshToken(token: string): string;
}
