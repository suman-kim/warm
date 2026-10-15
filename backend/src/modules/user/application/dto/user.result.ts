import { UserRole } from '../../../../common/domain/user-role.js';
import { User } from '../../domain/entities/user.entity.js';

/** 회원 정보 응답. */
export class UserResult {
  id: string;
  email: string;
  name: string;
  phone: string;
  role: UserRole;
  /** 마케팅 정보 수신에 동의했는지 */
  marketingAgreed: boolean;
  createdAt: Date;
}

export function toUserResult(user: User): UserResult {
  const state = user.snapshot();
  return {
    id: state.id,
    email: state.email.value,
    name: state.name,
    phone: state.phone.value,
    role: state.role,
    marketingAgreed: state.marketingAgreedAt !== null,
    createdAt: state.createdAt,
  };
}
