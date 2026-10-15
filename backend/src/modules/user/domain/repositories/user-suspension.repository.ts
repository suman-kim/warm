import { UserSuspension } from '../entities/user-suspension.entity.js';

/** 회원 정지 기록 저장소 DI 토큰. */
export const USER_SUSPENSION_REPOSITORY = Symbol('USER_SUSPENSION_REPOSITORY');

/** 회원 정지 기록 저장소 계약. */
export interface UserSuspensionRepository {
  save(suspension: UserSuspension): Promise<void>;
  /** 최근 것부터. */
  findByUserId(userId: string): Promise<UserSuspension[]>;
}
