import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import {
  ConflictError,
  NotFoundError,
} from '../../../../common/domain/domain-error.js';
import { User } from '../../../user/domain/entities/user.entity.js';
import {
  USER_REPOSITORY,
  type UserRepository,
} from '../../../user/domain/repositories/user.repository.js';
import { Email } from '../../../user/domain/value-objects/email.js';
import { AdminRole, areasOf } from '../../domain/admin-role.js';
import {
  AdminAccount,
  AdminStatus,
} from '../../domain/entities/admin-account.entity.js';
import {
  ADMIN_ACCOUNT_REPOSITORY,
  type AdminAccountRepository,
} from '../../domain/repositories/admin-account.repository.js';
import {
  AdminAccountResult,
  AdminMeResult,
} from '../dto/admin-account.result.js';
import {
  ADMIN_INVITATION_SENDER,
  type AdminInvitationSender,
} from '../ports/admin-invitation-sender.port.js';
import { newInvitationToken } from '../services/invitation-token.js';

export interface InviteAdminCommand {
  name: string;
  email: string;
  role: AdminRole;
}

export interface UpdateAdminCommand {
  role?: AdminRole;
  /** true면 다시 활성화, false면 비활성화 */
  active?: boolean;
}

/** 운영자 계정 관리 유스케이스. 최고 관리자가 초대하고, 권한을 바꾸고, 비활성화한다. */
@Injectable()
export class AdminAccountsUseCase {
  constructor(
    @Inject(ADMIN_ACCOUNT_REPOSITORY)
    private readonly accountRepository: AdminAccountRepository,
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepository,
    @Inject(ADMIN_INVITATION_SENDER)
    private readonly invitationSender: AdminInvitationSender,
  ) {}

  async me(userId: string): Promise<AdminMeResult> {
    const { account, user } = await this.load(userId);
    return { ...toResult(account, user), areas: [...areasOf(account.role)] };
  }

  async list(): Promise<AdminAccountResult[]> {
    const accounts = await this.accountRepository.findAll();
    const users = await this.userRepository.findByIds(
      accounts.map((account) => account.id),
    );
    const userById = new Map(users.map((user) => [user.id, user]));
    return accounts.flatMap((account) => {
      const user = userById.get(account.id);
      return user ? [toResult(account, user)] : [];
    });
  }

  /** 초대. 운영자 회원을 만들고 초대 메일을 보낸다. */
  async invite(command: InviteAdminCommand): Promise<AdminAccountResult> {
    const email = Email.of(command.email);
    if (await this.userRepository.findByEmail(email.value)) {
      throw new ConflictError(
        'EMAIL_ALREADY_REGISTERED',
        '이미 추가된 이메일이에요.',
      );
    }
    const now = new Date();
    const user = User.inviteAdmin({
      id: randomUUID(),
      email,
      name: command.name,
      now,
    });
    const { token, tokenHash } = newInvitationToken();
    const account = AdminAccount.invite({
      userId: user.id,
      role: command.role,
      tokenHash,
      now,
    });
    await this.userRepository.save(user);
    await this.accountRepository.save(account);
    await this.sendInvitation(account, user, token);
    return toResult(account, user);
  }

  /** 초대 메일 다시 보내기. 앞서 보낸 링크는 못 쓰게 된다. */
  async resendInvitation(id: string): Promise<void> {
    const { account, user } = await this.load(id);
    const { token, tokenHash } = newInvitationToken();
    account.reissueInvitation({ tokenHash, now: new Date() });
    await this.accountRepository.save(account);
    await this.sendInvitation(account, user, token);
  }

  /** 권한을 바꾸거나 비활성화·다시 활성화한다. 자기 계정은 바꿀 수 없다. */
  async update(
    actorId: string,
    id: string,
    command: UpdateAdminCommand,
  ): Promise<AdminAccountResult> {
    if (actorId === id) {
      throw new ConflictError(
        'CANNOT_CHANGE_OWN_ADMIN_ACCOUNT',
        '내 계정의 권한과 상태는 바꿀 수 없어요.',
      );
    }
    const { account, user } = await this.load(id);
    const losesSuper =
      account.role === AdminRole.SUPER &&
      account.isActive &&
      (command.active === false ||
        (command.role !== undefined && command.role !== AdminRole.SUPER));
    if (losesSuper && (await this.accountRepository.countActiveSupers()) <= 1) {
      throw new ConflictError(
        'LAST_SUPER_ADMIN',
        '최고 관리자가 한 명은 남아 있어야 해요.',
      );
    }
    if (command.role !== undefined) {
      account.changeRole(command.role);
    }
    if (command.active === false) {
      account.deactivate();
    } else if (command.active === true) {
      account.reactivate();
    }
    await this.accountRepository.save(account);
    return toResult(account, user);
  }

  private async sendInvitation(
    account: AdminAccount,
    user: User,
    token: string,
  ): Promise<void> {
    await this.invitationSender.send({
      email: user.email,
      name: user.name,
      token,
      expiresAt: account.snapshot().invitationExpiresAt!,
    });
  }

  private async load(
    userId: string,
  ): Promise<{ account: AdminAccount; user: User }> {
    const account = await this.accountRepository.findById(userId);
    const user = account && (await this.userRepository.findById(userId));
    if (!account || !user) {
      throw new NotFoundError('ADMIN_NOT_FOUND', '관리자를 찾을 수 없어요.');
    }
    return { account, user };
  }
}

function toResult(account: AdminAccount, user: User): AdminAccountResult {
  const state = account.snapshot();
  return {
    id: state.id,
    name: user.name,
    email: user.email,
    role: state.role,
    status: state.status as AdminStatus,
    lastLoginAt: state.lastLoginAt,
    createdAt: state.createdAt,
  };
}
