import { AggregateRoot } from '../../../../common/domain/aggregate-root.js';
import {
  ConflictError,
  InvalidArgumentError,
} from '../../../../common/domain/domain-error.js';
import { AdminArea, AdminRole, areasOf } from '../admin-role.js';

export enum AdminStatus {
  ACTIVE = 'ACTIVE',
  /** 초대 메일을 보냈고 아직 비밀번호를 정하지 않음 */
  INVITED = 'INVITED',
  /** 최고 관리자가 비활성화함 — 로그인할 수 없다 */
  INACTIVE = 'INACTIVE',
}

/** 초대 링크가 살아 있는 기간. */
export const INVITATION_VALID_MS = 7 * 24 * 60 * 60 * 1000;

export interface AdminAccountState {
  /** 회원 ID와 같다 — 운영자 회원 한 명에 하나다. */
  id: string;
  role: AdminRole;
  status: AdminStatus;
  /** 초대 링크에 든 토큰의 해시. 초대 중일 때만 있다. */
  invitationTokenHash: string | null;
  invitationExpiresAt: Date | null;
  lastLoginAt: Date | null;
  createdAt: Date;
}

export interface Invitation {
  tokenHash: string;
  now: Date;
}

/** 운영자 계정 애그리거트. 권한과 초대·비활성화 상태를 가진다. */
export class AdminAccount extends AggregateRoot {
  private constructor(
    private readonly state: AdminAccountState,
    version: number,
  ) {
    super(state.id, version);
  }

  /** 초대. 받은 사람이 초대 링크에서 비밀번호를 정해야 로그인할 수 있다. */
  static invite(
    input: { userId: string; role: AdminRole } & Invitation,
  ): AdminAccount {
    return new AdminAccount(
      {
        id: input.userId,
        role: input.role,
        status: AdminStatus.INVITED,
        invitationTokenHash: input.tokenHash,
        invitationExpiresAt: expiryFrom(input.now),
        lastLoginAt: null,
        createdAt: input.now,
      },
      0,
    );
  }

  /** 저장된 상태에서 되살린다 (저장소 전용). */
  static restore(state: AdminAccountState, version: number): AdminAccount {
    return new AdminAccount(state, version);
  }

  get role(): AdminRole {
    return this.state.role;
  }

  get status(): AdminStatus {
    return this.state.status;
  }

  get isActive(): boolean {
    return this.state.status === AdminStatus.ACTIVE;
  }

  /** 지금 이 영역의 일을 할 수 있는지. */
  can(area: AdminArea): boolean {
    return this.isActive && areasOf(this.state.role).includes(area);
  }

  /** 초대 링크로 들어와 비밀번호를 정했다. */
  acceptInvitation(tokenHash: string, now: Date): void {
    if (
      this.state.status !== AdminStatus.INVITED ||
      this.state.invitationTokenHash !== tokenHash ||
      !this.state.invitationExpiresAt ||
      this.state.invitationExpiresAt <= now
    ) {
      throw new InvalidArgumentError(
        'INVITATION_INVALID',
        '초대 링크가 만료됐거나 올바르지 않아요. 초대를 다시 요청해 주세요.',
      );
    }
    this.state.status = AdminStatus.ACTIVE;
    this.state.invitationTokenHash = null;
    this.state.invitationExpiresAt = null;
  }

  /** 초대 메일을 다시 보낸다. 앞서 보낸 링크는 못 쓰게 된다. */
  reissueInvitation(invitation: Invitation): void {
    if (this.state.status !== AdminStatus.INVITED) {
      throw new ConflictError(
        'ADMIN_NOT_INVITED',
        '초대 중인 관리자에게만 다시 보낼 수 있어요.',
      );
    }
    this.state.invitationTokenHash = invitation.tokenHash;
    this.state.invitationExpiresAt = expiryFrom(invitation.now);
  }

  deactivate(): void {
    if (this.state.status !== AdminStatus.ACTIVE) {
      throw new ConflictError(
        'ADMIN_NOT_ACTIVE',
        '활성 상태인 관리자만 비활성화할 수 있어요.',
      );
    }
    this.state.status = AdminStatus.INACTIVE;
  }

  reactivate(): void {
    if (this.state.status !== AdminStatus.INACTIVE) {
      throw new ConflictError(
        'ADMIN_NOT_INACTIVE',
        '비활성화된 관리자만 다시 활성화할 수 있어요.',
      );
    }
    this.state.status = AdminStatus.ACTIVE;
  }

  changeRole(role: AdminRole): void {
    this.state.role = role;
  }

  recordLogin(now: Date): void {
    this.state.lastLoginAt = now;
  }

  snapshot(): Readonly<AdminAccountState> {
    return { ...this.state };
  }
}

function expiryFrom(now: Date): Date {
  return new Date(now.getTime() + INVITATION_VALID_MS);
}
