import { AggregateRoot } from '../../../../common/domain/aggregate-root.js';
import {
  ConflictError,
  InvalidArgumentError,
} from '../../../../common/domain/domain-error.js';
import { PhoneNumber } from '../../../../common/domain/phone-number.js';
import { UserRole } from '../../../../common/domain/user-role.js';
import { UserStatus } from '../user-status.js';
import { Email } from '../value-objects/email.js';

export interface UserState {
  id: string;
  email: Email;
  passwordHash: string;
  name: string;
  phone: PhoneNumber;
  role: UserRole;
  status: UserStatus;
  /** 이용약관에 동의한 시각 (필수) */
  termsAgreedAt: Date;
  /** 개인정보 수집·이용에 동의한 시각 (필수) */
  privacyAgreedAt: Date;
  /** 마케팅 정보 수신에 동의한 시각. 동의하지 않았으면 null. */
  marketingAgreedAt: Date | null;
  createdAt: Date;
  withdrawnAt: Date | null;
  /** 정지가 끝나는 시각. 정지 중이 아니거나 무기한 정지면 null. */
  suspendedUntil: Date | null;
  /** 정지 사유. 정지된 회원이 로그인하려 하면 보여 준다. */
  suspensionReason: string | null;
}

/** 지금 걸려 있는 정지. [until]이 null이면 무기한. */
export interface CurrentSuspension {
  until: Date | null;
  reason: string;
}

/** 가입할 때 받는 약관 동의. */
export interface Agreements {
  terms: boolean;
  privacy: boolean;
  marketing: boolean;
}

export interface RegisterUserInput {
  id: string;
  email: Email;
  passwordHash: string;
  name: string;
  phone: PhoneNumber;
  role: UserRole;
  agreements: Agreements;
  now: Date;
}

/** 회원 애그리거트. 고객·기사·운영자 계정을 모두 나타낸다. */
export class User extends AggregateRoot {
  private constructor(
    private readonly state: UserState,
    version: number,
  ) {
    super(state.id, version);
  }

  /** 신규 가입. 필수 약관에 동의해야 하고, 운영자 계정은 가입으로 만들 수 없다. */
  static register(input: RegisterUserInput): User {
    if (input.role === UserRole.ADMIN) {
      throw new InvalidArgumentError(
        'ROLE_NOT_ALLOWED',
        '가입할 수 없는 역할이에요.',
      );
    }
    if (!input.agreements.terms || !input.agreements.privacy) {
      throw new InvalidArgumentError(
        'AGREEMENT_REQUIRED',
        '필수 약관에 동의해 주세요.',
      );
    }
    return new User(
      {
        id: input.id,
        email: input.email,
        passwordHash: input.passwordHash,
        name: normalizeName(input.name),
        phone: input.phone,
        role: input.role,
        status: UserStatus.ACTIVE,
        termsAgreedAt: input.now,
        privacyAgreedAt: input.now,
        marketingAgreedAt: input.agreements.marketing ? input.now : null,
        createdAt: input.now,
        withdrawnAt: null,
        suspendedUntil: null,
        suspensionReason: null,
      },
      0,
    );
  }

  /**
   * 운영자 초대. 가입으로는 만들 수 없는 운영자 계정을 만든다.
   * 비밀번호는 초대받은 사람이 정한다 — 그때까지는 어떤 비밀번호로도 로그인할 수 없다.
   */
  static inviteAdmin(input: {
    id: string;
    email: Email;
    name: string;
    now: Date;
  }): User {
    return new User(
      {
        id: input.id,
        email: input.email,
        passwordHash: '',
        name: normalizeName(input.name),
        // 운영자는 휴대폰 번호를 받지 않는다.
        phone: PhoneNumber.of('00000000000'),
        role: UserRole.ADMIN,
        status: UserStatus.ACTIVE,
        termsAgreedAt: input.now,
        privacyAgreedAt: input.now,
        marketingAgreedAt: null,
        createdAt: input.now,
        withdrawnAt: null,
        suspendedUntil: null,
        suspensionReason: null,
      },
      0,
    );
  }

  /** 저장된 상태에서 되살린다 (저장소 전용). */
  static restore(state: UserState, version: number): User {
    return new User(state, version);
  }

  get email(): string {
    return this.state.email.value;
  }

  get passwordHash(): string {
    return this.state.passwordHash;
  }

  get name(): string {
    return this.state.name;
  }

  get phone(): string {
    return this.state.phone.value;
  }

  get role(): UserRole {
    return this.state.role;
  }

  /** 지금 서비스를 쓸 수 있는지. 기간이 끝난 정지는 풀린 것으로 본다. */
  isActive(now: Date = new Date()): boolean {
    return (
      this.state.status === UserStatus.ACTIVE ||
      (this.state.status === UserStatus.SUSPENDED &&
        this.suspension(now) === null)
    );
  }

  /** 지금 걸려 있는 정지. 정지 중이 아니거나 기간이 끝났으면 null. */
  suspension(now: Date): CurrentSuspension | null {
    const { status, suspendedUntil, suspensionReason } = this.state;
    if (
      status !== UserStatus.SUSPENDED ||
      (suspendedUntil !== null && suspendedUntil <= now)
    ) {
      return null;
    }
    return { until: suspendedUntil, reason: suspensionReason ?? '' };
  }

  /**
   * 운영자가 이용을 정지한다. [until]이 null이면 해제할 때까지 무기한이다.
   * 고객과 기사만 정지할 수 있다 — 운영자 계정은 비활성화로 막는다.
   */
  suspend(reason: string, until: Date | null, now: Date): void {
    if (this.state.role === UserRole.ADMIN) {
      throw new ConflictError(
        'CANNOT_SUSPEND_ADMIN',
        '운영자 계정은 정지할 수 없어요.',
      );
    }
    if (this.state.status === UserStatus.WITHDRAWN) {
      throw new ConflictError('ALREADY_WITHDRAWN', '이미 탈퇴한 계정이에요.');
    }
    if (this.suspension(now)) {
      throw new ConflictError('ALREADY_SUSPENDED', '이미 정지된 계정이에요.');
    }
    const trimmed = reason.trim();
    if (trimmed.length < 5 || trimmed.length > 500) {
      throw new InvalidArgumentError(
        'INVALID_SUSPENSION_REASON',
        '정지 사유를 5자 이상 적어 주세요.',
      );
    }
    this.state.status = UserStatus.SUSPENDED;
    this.state.suspendedUntil = until;
    this.state.suspensionReason = trimmed;
  }

  /** 정지를 해제한다. 바로 다시 로그인할 수 있다. */
  liftSuspension(now: Date): void {
    if (!this.suspension(now)) {
      throw new ConflictError('NOT_SUSPENDED', '정지된 계정이 아니에요.');
    }
    this.state.status = UserStatus.ACTIVE;
    this.state.suspendedUntil = null;
    this.state.suspensionReason = null;
  }

  /** 이름·휴대폰 번호·마케팅 수신 동의를 바꾼다. 주지 않은 항목은 그대로 둔다. */
  updateProfile(
    changes: { name?: string; phone?: PhoneNumber; marketingAgreed?: boolean },
    now: Date,
  ): void {
    if (changes.name !== undefined) {
      this.state.name = normalizeName(changes.name);
    }
    if (changes.phone !== undefined) {
      this.state.phone = changes.phone;
    }
    if (changes.marketingAgreed !== undefined) {
      // 이미 동의한 상태에서 다시 동의해도 처음 동의한 시각을 유지한다.
      this.state.marketingAgreedAt = changes.marketingAgreed
        ? (this.state.marketingAgreedAt ?? now)
        : null;
    }
  }

  changePassword(passwordHash: string): void {
    this.state.passwordHash = passwordHash;
  }

  /**
   * 탈퇴. 계정을 쓸 수 없게 하고 개인정보를 지운다.
   * 이메일을 비워 같은 이메일로 다시 가입할 수 있게 한다.
   */
  withdraw(now: Date): void {
    if (this.state.status === UserStatus.WITHDRAWN) {
      throw new ConflictError('ALREADY_WITHDRAWN', '이미 탈퇴한 계정이에요.');
    }
    this.state.status = UserStatus.WITHDRAWN;
    this.state.withdrawnAt = now;
    this.state.email = Email.of(`withdrawn-${this.id}@withdrawn.invalid`);
    this.state.name = '탈퇴한 회원';
    this.state.phone = PhoneNumber.of('00000000000');
    this.state.passwordHash = '';
    this.state.marketingAgreedAt = null;
    this.state.suspendedUntil = null;
    this.state.suspensionReason = null;
  }

  snapshot(): Readonly<UserState> {
    return { ...this.state };
  }
}

function normalizeName(raw: string): string {
  const name = raw.trim();
  if (name.length < 1 || name.length > 50) {
    throw new InvalidArgumentError(
      'INVALID_NAME',
      '이름은 1~50자로 입력해 주세요.',
    );
  }
  return name;
}
