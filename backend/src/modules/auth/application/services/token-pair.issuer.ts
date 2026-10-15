import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { toUserResult } from '../../../user/application/dto/user.result.js';
import { User } from '../../../user/domain/entities/user.entity.js';
import { RefreshToken } from '../../domain/entities/refresh-token.entity.js';
import {
  REFRESH_TOKEN_REPOSITORY,
  type RefreshTokenRepository,
} from '../../domain/repositories/refresh-token.repository.js';
import { AuthTokensResult } from '../dto/auth-tokens.result.js';
import {
  TOKEN_SERVICE,
  type TokenService,
} from '../ports/token-service.port.js';

/** 액세스·리프레시 토큰 한 쌍을 발급한다. 가입·로그인·갱신이 함께 쓴다. */
@Injectable()
export class TokenPairIssuer {
  constructor(
    @Inject(TOKEN_SERVICE)
    private readonly tokenService: TokenService,
    @Inject(REFRESH_TOKEN_REPOSITORY)
    private readonly refreshTokenRepository: RefreshTokenRepository,
  ) {}

  async issueFor(user: User, now: Date): Promise<AuthTokensResult> {
    const accessToken = await this.tokenService.signAccessToken({
      sub: user.id,
      role: user.role,
    });
    const refresh = this.tokenService.issueRefreshToken(now);
    await this.refreshTokenRepository.save(
      new RefreshToken(
        randomUUID(),
        user.id,
        refresh.tokenHash,
        refresh.expiresAt,
        null,
        now,
      ),
    );
    return {
      accessToken,
      refreshToken: refresh.token,
      user: toUserResult(user),
    };
  }
}
