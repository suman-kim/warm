import { Inject, Injectable } from '@nestjs/common';
import { InvalidArgumentError } from '../../../../common/domain/domain-error.js';
import { AdminInvitationResult } from '../../../admin/application/dto/admin-account.result.js';
import { hashInvitationToken } from '../../../admin/application/services/invitation-token.js';
import {
  AdminAccount,
  AdminStatus,
} from '../../../admin/domain/entities/admin-account.entity.js';
import {
  ADMIN_ACCOUNT_REPOSITORY,
  type AdminAccountRepository,
} from '../../../admin/domain/repositories/admin-account.repository.js';
import { User } from '../../../user/domain/entities/user.entity.js';
import {
  USER_REPOSITORY,
  type UserRepository,
} from '../../../user/domain/repositories/user.repository.js';
import { assertStrongPassword } from '../../domain/password-policy.js';
import { AuthTokensResult } from '../dto/auth-tokens.result.js';
import {
  PASSWORD_HASHER,
  type PasswordHasher,
} from '../ports/password-hasher.port.js';
import { TokenPairIssuer } from '../services/token-pair.issuer.js';

/** 운영자 초대 수락 유스케이스. 초대 링크에서 비밀번호를 정하면 바로 로그인된다. */
@Injectable()
export class AdminInvitationUseCase {
  constructor(
    @Inject(ADMIN_ACCOUNT_REPOSITORY)
    private readonly accountRepository: AdminAccountRepository,
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepository,
    @Inject(PASSWORD_HASHER)
    private readonly passwordHasher: PasswordHasher,
    private readonly tokenPairIssuer: TokenPairIssuer,
  ) {}

  /** 초대 링크가 살아 있는지 확인하고, 누구를 초대했는지 알려 준다. */
  async find(token: string): Promise<AdminInvitationResult> {
    const { account, user } = await this.load(token);
    const expiresAt = account.snapshot().invitationExpiresAt;
    if (
      account.status !== AdminStatus.INVITED ||
      !expiresAt ||
      expiresAt <= new Date()
    ) {
      throw invalidInvitation();
    }
    return { name: user.name, email: user.email, expiresAt };
  }

  async accept(token: string, password: string): Promise<AuthTokensResult> {
    assertStrongPassword(password);
    const { account, user } = await this.load(token);
    const now = new Date();
    account.acceptInvitation(hashInvitationToken(token), now);
    account.recordLogin(now);
    user.changePassword(await this.passwordHasher.hash(password));
    await this.userRepository.save(user);
    await this.accountRepository.save(account);
    return this.tokenPairIssuer.issueFor(user, now);
  }

  private async load(
    token: string,
  ): Promise<{ account: AdminAccount; user: User }> {
    const account = await this.accountRepository.findByInvitationTokenHash(
      hashInvitationToken(token),
    );
    const user = account && (await this.userRepository.findById(account.id));
    if (!account || !user) {
      throw invalidInvitation();
    }
    return { account, user };
  }
}

function invalidInvitation(): InvalidArgumentError {
  return new InvalidArgumentError(
    'INVITATION_INVALID',
    '초대 링크가 만료됐거나 올바르지 않아요. 초대를 다시 요청해 주세요.',
  );
}
