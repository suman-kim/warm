import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ForbiddenError } from '../../../../common/domain/domain-error.js';
import { UserRole } from '../../../../common/domain/user-role.js';
import { AuthenticatedRequest } from '../../../auth/presentation/guards/jwt-auth.guard.js';
import { AdminAccessService } from '../../application/services/admin-access.service.js';
import { AdminArea } from '../../domain/admin-role.js';
import {
  ADMIN_ACCESS_KEY,
  ANY_ADMIN,
} from '../decorators/admin-access.decorator.js';

/**
 * 전역 운영자 가드. `@AdminAccess()`가 붙은 라우트에서 운영자인지, 활성 상태인지,
 * 그 메뉴의 권한이 있는지 확인한다. JwtAuthGuard 뒤에 돈다.
 */
@Injectable()
export class AdminAccessGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly adminAccessService: AdminAccessService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const access = this.reflector.getAllAndOverride<
      AdminArea | typeof ANY_ADMIN | undefined
    >(ADMIN_ACCESS_KEY, [context.getHandler(), context.getClass()]);
    if (!access) {
      return true;
    }
    const { user } = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (user?.role !== UserRole.ADMIN) {
      throw new ForbiddenError('ROLE_NOT_PERMITTED', '접근 권한이 없어요.');
    }
    await this.adminAccessService.authorize(
      user.id,
      access === ANY_ADMIN ? null : access,
    );
    return true;
  }
}
