import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthenticatedUser } from '../../../../common/application/authenticated-user.js';
import { AuthenticatedRequest } from '../guards/jwt-auth.guard.js';

/** JwtAuthGuard가 요청에 넣어 둔 인증된 회원을 컨트롤러 파라미터로 꺼낸다. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser =>
    ctx.switchToHttp().getRequest<AuthenticatedRequest>().user!,
);
