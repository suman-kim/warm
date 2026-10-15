import { AdminArea, AdminRole } from '../../domain/admin-role.js';
import { AdminStatus } from '../../domain/entities/admin-account.entity.js';

/** 운영자 계정 응답. */
export class AdminAccountResult {
  /** 회원 ID */
  id: string;
  name: string;
  email: string;
  role: AdminRole;
  status: AdminStatus;
  lastLoginAt: Date | null;
  /** 추가한 날 */
  createdAt: Date;
}

/** 로그인한 운영자 자신. 쓸 수 있는 메뉴가 붙는다. */
export class AdminMeResult extends AdminAccountResult {
  areas: AdminArea[];
}

/** 초대받은 사람에게 보여 줄 정보. */
export class AdminInvitationResult {
  name: string;
  email: string;
  expiresAt: Date;
}
