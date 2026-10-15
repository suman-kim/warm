import { UserRole } from '../domain/user-role.js';

/** 인증을 통과한 요청의 주체. 가드가 만들고 유스케이스가 받는다. */
export interface AuthenticatedUser {
  id: string;
  email: string;
  role: UserRole;
}
