import { SetMetadata } from '@nestjs/common';
import { UserRole } from '../../../../common/domain/user-role.js';

export const ROLES_KEY = 'roles';

/** 이 역할 중 하나를 가진 회원만 부를 수 있는 라우트로 표시한다. */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
