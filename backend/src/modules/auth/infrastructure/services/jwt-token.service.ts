import { createHash, randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  AccessTokenClaims,
  IssuedRefreshToken,
  TokenService,
} from '../../application/ports/token-service.port.js';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * 토큰 서비스 구현체.
 * 액세스 토큰은 JWT, 리프레시 토큰은 무작위 문자열이다(해시만 DB에 둔다).
 */
@Injectable()
export class JwtTokenService implements TokenService {
  private readonly refreshTtlMs: number;

  constructor(
    private readonly jwtService: JwtService,
    config: ConfigService,
  ) {
    this.refreshTtlMs =
      config.getOrThrow<number>('JWT_REFRESH_EXPIRES_DAYS') * DAY_MS;
  }

  signAccessToken(claims: AccessTokenClaims): Promise<string> {
    return this.jwtService.signAsync({ sub: claims.sub, role: claims.role });
  }

  async verifyAccessToken(token: string): Promise<AccessTokenClaims | null> {
    try {
      const payload =
        await this.jwtService.verifyAsync<AccessTokenClaims>(token);
      return { sub: payload.sub, role: payload.role };
    } catch {
      return null;
    }
  }

  issueRefreshToken(now: Date): IssuedRefreshToken {
    const token = randomBytes(48).toString('base64url');
    return {
      token,
      tokenHash: this.hashRefreshToken(token),
      expiresAt: new Date(now.getTime() + this.refreshTtlMs),
    };
  }

  hashRefreshToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
