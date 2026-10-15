import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import {
  type ConsentKind,
  LEGAL_CONSENT_RECORDER,
  type LegalConsentRecorder,
} from '../../../../common/application/legal-consent.port.js';
import { ConflictError } from '../../../../common/domain/domain-error.js';
import { PhoneNumber } from '../../../../common/domain/phone-number.js';
import { UserRole } from '../../../../common/domain/user-role.js';
import { Agreements, User } from '../../../user/domain/entities/user.entity.js';
import {
  USER_REPOSITORY,
  type UserRepository,
} from '../../../user/domain/repositories/user.repository.js';
import { Email } from '../../../user/domain/value-objects/email.js';
import { assertStrongPassword } from '../../domain/password-policy.js';
import { AuthTokensResult } from '../dto/auth-tokens.result.js';
import {
  PASSWORD_HASHER,
  type PasswordHasher,
} from '../ports/password-hasher.port.js';
import { TokenPairIssuer } from '../services/token-pair.issuer.js';

export interface RegisterCommand {
  email: string;
  password: string;
  name: string;
  phone: string;
  role: UserRole;
  agreements: Agreements;
}

/** 회원가입 유스케이스. 가입하면 바로 로그인된 상태가 된다. */
@Injectable()
export class RegisterUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepository,
    @Inject(PASSWORD_HASHER)
    private readonly passwordHasher: PasswordHasher,
    private readonly tokenPairIssuer: TokenPairIssuer,
    @Inject(LEGAL_CONSENT_RECORDER)
    private readonly consents: LegalConsentRecorder,
  ) {}

  async execute(command: RegisterCommand): Promise<AuthTokensResult> {
    assertStrongPassword(command.password);
    const email = Email.of(command.email);
    if (await this.userRepository.findByEmail(email.value)) {
      throw new ConflictError(
        'EMAIL_ALREADY_REGISTERED',
        '이미 가입된 이메일이에요.',
      );
    }

    const now = new Date();
    const user = User.register({
      id: randomUUID(),
      email,
      passwordHash: await this.passwordHasher.hash(command.password),
      name: command.name,
      phone: PhoneNumber.of(command.phone),
      role: command.role,
      agreements: command.agreements,
      now,
    });
    await this.userRepository.save(user);
    // 어느 판에 동의했는지 남긴다 (필수 약관은 User.register가 동의했는지 확인했다).
    const kinds: ConsentKind[] = ['TERMS', 'PRIVACY'];
    if (command.agreements.marketing) kinds.push('MARKETING');
    await this.consents.record(user.id, kinds, now);
    return this.tokenPairIssuer.issueFor(user, now);
  }
}
