import { Inject, Injectable } from '@nestjs/common';
import { AuthenticatedUser } from '../../../../common/application/authenticated-user.js';
import { UnauthenticatedError } from '../../../../common/domain/domain-error.js';
import {
  USER_REPOSITORY,
  type UserRepository,
} from '../../../user/domain/repositories/user.repository.js';
import {
  TOKEN_SERVICE,
  type TokenService,
} from '../ports/token-service.port.js';

/** 액세스 토큰으로 요청의 주체를 확인하는 유스케이스. 가드가 요청마다 부른다. */
@Injectable()
export class AuthenticateUseCase {
  constructor(
    @Inject(TOKEN_SERVICE)
    private readonly tokenService: TokenService,
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepository,
  ) {}

  async execute(accessToken: string | null): Promise<AuthenticatedUser> {
    const claims = accessToken
      ? await this.tokenService.verifyAccessToken(accessToken)
      : null;
    if (!claims) {
      throw new UnauthenticatedError(
        'INVALID_ACCESS_TOKEN',
        '로그인이 필요해요.',
      );
    }
    // 토큰이 유효해도 정지·탈퇴한 계정이면 막는다. 역할도 토큰이 아닌 현재 값을 쓴다.
    const user = await this.userRepository.findById(claims.sub);
    if (!user || !user.isActive()) {
      throw new UnauthenticatedError(
        'ACCOUNT_INACTIVE',
        '이용할 수 없는 계정이에요.',
      );
    }
    return { id: user.id, email: user.email, role: user.role };
  }
}
