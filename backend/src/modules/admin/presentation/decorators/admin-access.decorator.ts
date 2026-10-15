import { SetMetadata } from '@nestjs/common';
import { AdminArea } from '../../domain/admin-role.js';

export const ADMIN_ACCESS_KEY = 'adminAccess';

/** 영역을 정하지 않은 운영자 API — 활성 상태인 운영자면 누구나 부른다. */
export const ANY_ADMIN = 'ANY';

/**
 * 운영자만 부를 수 있는 라우트로 표시한다. [area]를 주면 그 메뉴를 쓸 권한이 있는 운영자만 부른다.
 * 요청마다 운영자 계정의 현재 상태를 확인한다 (AdminAccessGuard).
 */
export const AdminAccess = (area: AdminArea | typeof ANY_ADMIN = ANY_ADMIN) =>
  SetMetadata(ADMIN_ACCESS_KEY, area);
