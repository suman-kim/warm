import { Inject, Injectable } from '@nestjs/common';
import {
  TooManyRequestsError,
  UnauthenticatedError,
} from '../../../../common/domain/domain-error.js';
import { kstDateString } from '../../../../common/domain/kst.js';
import { UserRole } from '../../../../common/domain/user-role.js';
import { AdminStatus } from '../../../admin/domain/entities/admin-account.entity.js';
import {
  ADMIN_ACCOUNT_REPOSITORY,
  type AdminAccountRepository,
} from '../../../admin/domain/repositories/admin-account.repository.js';
import {
  USER_REPOSITORY,
  type UserRepository,
} from '../../../user/domain/repositories/user.repository.js';
import { LoginAttempt } from '../../domain/entities/login-attempt.entity.js';
import {
  LOGIN_ATTEMPT_REPOSITORY,
  type LoginAttemptRepository,
} from '../../domain/repositories/login-attempt.repository.js';
import { AuthTokensResult } from '../dto/auth-tokens.result.js';
import {
  PASSWORD_HASHER,
  type PasswordHasher,
} from '../ports/password-hasher.port.js';
import { TokenPairIssuer } from '../services/token-pair.issuer.js';

/**
 * 로그인 유스케이스. 한 이메일로 15분 안에 다섯 번 틀리면 15분 동안 막는다 (맞는 비밀번호여도).
 */
@Injectable()
export class LoginUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepository,
    @Inject(ADMIN_ACCOUNT_REPOSITORY)
    private readonly adminAccountRepository: AdminAccountRepository,
    @Inject(PASSWORD_HASHER)
    private readonly passwordHasher: PasswordHasher,
    private readonly tokenPairIssuer: TokenPairIssuer,
    @Inject(LOGIN_ATTEMPT_REPOSITORY)
    private readonly attempts: LoginAttemptRepository,
  ) {}

  async execute(email: string, password: string): Promise<AuthTokensResult> {
    const key = email.trim().toLowerCase();
    const now = new Date();
    const attempt = await this.attempts.find(key);
    if (attempt?.isLocked(now)) {
      throw locked(attempt, now);
    }
    const user = await this.userRepository.findByEmail(key);
    const admin =
      user?.role === UserRole.ADMIN
        ? await this.adminAccountRepository.findById(user.id)
        : null;
    // 초대만 받은 운영자는 아직 비밀번호가 없다 — 무엇을 해야 하는지 알려 준다.
    if (admin?.status === AdminStatus.INVITED) {
      throw new UnauthenticatedError(
        'ADMIN_INVITATION_PENDING',
        '초대 메일에서 비밀번호를 먼저 정해 주세요.',
      );
    }
    // 가입 여부를 알려주지 않도록 이메일이 없을 때와 비밀번호가 틀렸을 때를 구분하지 않는다.
    if (
      !user ||
      !(await this.passwordHasher.matches(password, user.passwordHash))
    ) {
      const failed = attempt ?? LoginAttempt.first(key, now);
      const nowLocked = failed.recordFailure(now);
      await this.attempts.save(failed);
      if (nowLocked) {
        throw locked(failed, now);
      }
      throw new UnauthenticatedError(
        'INVALID_CREDENTIALS',
        '이메일 또는 비밀번호가 올바르지 않아요.',
      );
    }
    if (attempt) {
      await this.attempts.delete(key);
    }
    const suspension = user.suspension(now);
    if (suspension) {
      throw new UnauthenticatedError(
        'ACCOUNT_SUSPENDED',
        `이용이 정지된 계정이에요 (${
          suspension.until ? `${kstDateString(suspension.until)}까지` : '무기한'
        }). 사유: ${suspension.reason}`,
      );
    }
    if (!user.isActive(now)) {
      throw new UnauthenticatedError(
        'ACCOUNT_INACTIVE',
        '이용할 수 없는 계정이에요.',
      );
    }
    if (user.role === UserRole.ADMIN) {
      if (!admin?.isActive) {
        throw new UnauthenticatedError(
          'ADMIN_INACTIVE',
          '비활성화된 계정이에요. 최고 관리자에게 문의해 주세요.',
        );
      }
      admin.recordLogin(now);
      await this.adminAccountRepository.save(admin);
    }
    return this.tokenPairIssuer.issueFor(user, now);
  }
}

function locked(attempt: LoginAttempt, now: Date): TooManyRequestsError {
  return new TooManyRequestsError(
    'LOGIN_LOCKED',
    `로그인을 여러 번 실패해서 잠시 막았어요. ${attempt.minutesLeft(now)}분 뒤에 다시 시도하거나 비밀번호를 찾아 주세요.`,
  );
}
