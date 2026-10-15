import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { AuthenticatedUser } from '../../../../common/application/authenticated-user.js';
import { AuthenticateUseCase } from '../../application/use-cases/authenticate.use-case.js';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js';

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

/**
 * 전역 인증 가드. `@Public()`이 없는 모든 라우트에서 Bearer 액세스 토큰을 확인하고
 * 인증된 회원을 request.user에 넣는다.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authenticateUseCase: AuthenticateUseCase,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    request.user = await this.authenticateUseCase.execute(
      extractBearerToken(request.headers.authorization),
    );
    return true;
  }
}

function extractBearerToken(header: string | undefined): string | null {
  const [scheme, token] = header?.split(' ') ?? [];
  return scheme === 'Bearer' && token ? token : null;
}
