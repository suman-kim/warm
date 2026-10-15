import { User } from '../entities/user.entity.js';

/** 회원 저장소 DI 토큰. */
export const USER_REPOSITORY = Symbol('USER_REPOSITORY');

/** 회원 저장소 계약. */
export interface UserRepository {
  save(user: User): Promise<void>;
  findById(id: string): Promise<User | null>;
  findByIds(ids: string[]): Promise<User[]>;
  /** 정규화된(소문자) 이메일로 찾는다. */
  findByEmail(email: string): Promise<User | null>;
}
