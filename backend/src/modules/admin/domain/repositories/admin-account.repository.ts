import { AdminAccount } from '../entities/admin-account.entity.js';

/** 운영자 계정 저장소 DI 토큰. */
export const ADMIN_ACCOUNT_REPOSITORY = Symbol('ADMIN_ACCOUNT_REPOSITORY');

/** 운영자 계정 저장소 계약. */
export interface AdminAccountRepository {
  save(account: AdminAccount): Promise<void>;
  /** 운영자 계정의 ID는 회원 ID와 같다. */
  findById(userId: string): Promise<AdminAccount | null>;
  findByInvitationTokenHash(tokenHash: string): Promise<AdminAccount | null>;
  /** 추가한 순서대로 전부. */
  findAll(): Promise<AdminAccount[]>;
  /** 활성 상태인 최고 관리자 수. 마지막 한 명은 없앨 수 없다. */
  countActiveSupers(): Promise<number>;
}
