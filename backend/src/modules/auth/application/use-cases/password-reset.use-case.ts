import { createHash, randomInt, randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { InvalidArgumentError } from '../../../../common/domain/domain-error.js';
import {
  USER_REPOSITORY,
  type UserRepository,
} from '../../../user/domain/repositories/user.repository.js';
import { PasswordResetCode } from '../../domain/entities/password-reset-code.entity.js';
import { assertStrongPassword } from '../../domain/password-policy.js';
import {
  PASSWORD_RESET_CODE_REPOSITORY,
  type PasswordResetCodeRepository,
} from '../../domain/repositories/password-reset-code.repository.js';
import {
  REFRESH_TOKEN_REPOSITORY,
  type RefreshTokenRepository,
} from '../../domain/repositories/refresh-token.repository.js';
import {
  PASSWORD_HASHER,
  type PasswordHasher,
} from '../ports/password-hasher.port.js';
import {
  RESET_CODE_SENDER,
  type ResetCodeSender,
} from '../ports/reset-code-sender.port.js';

/**
 * 비밀번호 찾기 유스케이스. 이메일로 6자리 인증 코드를 받고(10분 유효),
 * 그 코드와 함께 새 비밀번호를 보내면 바뀐다.
 */
@Injectable()
export class PasswordResetUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepository,
    @Inject(PASSWORD_RESET_CODE_REPOSITORY)
    private readonly codeRepository: PasswordResetCodeRepository,
    @Inject(REFRESH_TOKEN_REPOSITORY)
    private readonly refreshTokenRepository: RefreshTokenRepository,
    @Inject(PASSWORD_HASHER)
    private readonly passwordHasher: PasswordHasher,
    @Inject(RESET_CODE_SENDER)
    private readonly codeSender: ResetCodeSender,
  ) {}

  /**
   * 인증 코드를 보낸다. 가입하지 않은 이메일이어도 똑같이 성공한다 (가입 여부를 알려주지 않는다).
   * 1분 안에 다시 요청하면 새로 보내지 않는다.
   */
  async request(email: string): Promise<void> {
    const user = await this.userRepository.findByEmail(
      email.trim().toLowerCase(),
    );
    if (!user || !user.isActive()) {
      return;
    }
    const now = new Date();
    const previous = await this.codeRepository.findByUserId(user.id);
    // 방금 보냈으면 다시 보내지 않는다. 앞서 받은 코드는 그대로 쓸 수 있다.
    if (previous && !previous.canBeReplaced(now)) {
      return;
    }
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    await this.codeRepository.replaceForUser(
      PasswordResetCode.issue({
        id: randomUUID(),
        userId: user.id,
        codeHash: hashCode(user.id, code),
        now,
      }),
    );
    await this.codeSender.send(user.email, code);
  }

  /** 코드가 맞으면 비밀번호를 바꾸고, 그 계정의 모든 기기를 로그아웃시킨다. */
  async confirm(
    email: string,
    code: string,
    newPassword: string,
  ): Promise<void> {
    assertStrongPassword(newPassword);
    const now = new Date();
    const user = await this.userRepository.findByEmail(
      email.trim().toLowerCase(),
    );
    const stored = user && (await this.codeRepository.findByUserId(user.id));
    if (!user || !user.isActive() || !stored || !stored.isUsable(now)) {
      throw invalidCode();
    }
    if (stored.codeHash !== hashCode(user.id, code)) {
      await this.codeRepository.recordFailedAttempt(stored.id);
      throw invalidCode();
    }

    user.changePassword(await this.passwordHasher.hash(newPassword));
    await this.userRepository.save(user);
    await this.codeRepository.markUsed(stored.id, now);
    await this.refreshTokenRepository.revokeAllByUser(user.id, now);
  }
}

/** 코드는 6자리라 그대로 해시하면 금방 찾아낼 수 있다. 회원 ID를 섞어 다른 회원의 코드와 겹치지 않게 한다. */
function hashCode(userId: string, code: string): string {
  return createHash('sha256').update(`${userId}:${code}`).digest('hex');
}

function invalidCode(): InvalidArgumentError {
  return new InvalidArgumentError(
    'INVALID_RESET_CODE',
    '인증 코드가 올바르지 않거나 만료됐어요. 코드를 다시 받아 주세요.',
  );
}
