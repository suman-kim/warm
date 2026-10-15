import { Inject, Injectable } from '@nestjs/common';
import {
  REFRESH_TOKEN_REPOSITORY,
  type RefreshTokenRepository,
} from '../../domain/repositories/refresh-token.repository.js';
import {
  TOKEN_SERVICE,
  type TokenService,
} from '../ports/token-service.port.js';

/** 로그아웃 유스케이스. 리프레시 토큰을 폐기한다. 이미 폐기됐어도 성공으로 본다. */
@Injectable()
export class LogoutUseCase {
  constructor(
    @Inject(TOKEN_SERVICE)
    private readonly tokenService: TokenService,
    @Inject(REFRESH_TOKEN_REPOSITORY)
    private readonly refreshTokenRepository: RefreshTokenRepository,
  ) {}

  async execute(refreshToken: string): Promise<void> {
    await this.refreshTokenRepository.revokeByHash(
      this.tokenService.hashRefreshToken(refreshToken),
      new Date(),
    );
  }
}
