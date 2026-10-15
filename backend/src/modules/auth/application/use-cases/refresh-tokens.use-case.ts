import { Inject, Injectable } from '@nestjs/common';
import { UnauthenticatedError } from '../../../../common/domain/domain-error.js';
import {
  USER_REPOSITORY,
  type UserRepository,
} from '../../../user/domain/repositories/user.repository.js';
import {
  REFRESH_TOKEN_REPOSITORY,
  type RefreshTokenRepository,
} from '../../domain/repositories/refresh-token.repository.js';
import { AuthTokensResult } from '../dto/auth-tokens.result.js';
import {
  TOKEN_SERVICE,
  type TokenService,
} from '../ports/token-service.port.js';
import { TokenPairIssuer } from '../services/token-pair.issuer.js';

/** 토큰 갱신 유스케이스. 쓴 리프레시 토큰은 폐기하고 새 쌍을 발급한다. */
@Injectable()
export class RefreshTokensUseCase {
  constructor(
    @Inject(TOKEN_SERVICE)
    private readonly tokenService: TokenService,
    @Inject(REFRESH_TOKEN_REPOSITORY)
    private readonly refreshTokenRepository: RefreshTokenRepository,
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepository,
    private readonly tokenPairIssuer: TokenPairIssuer,
  ) {}

  async execute(refreshToken: string): Promise<AuthTokensResult> {
    const now = new Date();
    const tokenHash = this.tokenService.hashRefreshToken(refreshToken);
    const stored = await this.refreshTokenRepository.findByHash(tokenHash);
    if (!stored || !stored.isUsable(now)) {
      throw invalidRefreshToken();
    }
    const user = await this.userRepository.findById(stored.userId);
    if (!user || !user.isActive()) {
      throw invalidRefreshToken();
    }
    // 같은 토큰으로 동시에 들어온 요청 중 하나만 통과시킨다.
    if (!(await this.refreshTokenRepository.revokeByHash(tokenHash, now))) {
      throw invalidRefreshToken();
    }
    return this.tokenPairIssuer.issueFor(user, now);
  }
}

function invalidRefreshToken(): UnauthenticatedError {
  return new UnauthenticatedError(
    'INVALID_REFRESH_TOKEN',
    '다시 로그인해 주세요.',
  );
}
