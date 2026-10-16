import { createHash, randomBytes, randomInt, randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import {
  InvalidArgumentError,
  TooManyRequestsError,
} from '../../../../common/domain/domain-error.js';
import { PhoneNumber } from '../../../../common/domain/phone-number.js';
import { PhoneVerification } from '../../domain/entities/phone-verification.entity.js';
import {
  PHONE_VERIFICATION_REPOSITORY,
  type PhoneVerificationRepository,
} from '../../domain/repositories/phone-verification.repository.js';
import { SMS_SENDER, type SmsSender } from '../ports/sms-sender.port.js';

/** 코드를 보낸 결과. */
export interface PhoneCodeSentResult {
  /** 코드가 만료되는 시각 */
  expiresAt: Date;
}

/** 인증을 마친 결과. */
export interface PhoneVerifiedResult {
  /** 가입할 때 함께 보내는 토큰 (30분, 한 번) */
  verificationToken: string;
  expiresAt: Date;
}

/**
 * 휴대폰 인증 유스케이스 (손님 가입).
 * 문자로 6자리 코드를 보내고(5분 유효, 1분에 한 번), 맞히면 가입에 한 번 쓸 수 있는 토큰을 준다.
 */
@Injectable()
export class PhoneVerificationUseCase {
  constructor(
    @Inject(PHONE_VERIFICATION_REPOSITORY)
    private readonly repository: PhoneVerificationRepository,
    @Inject(SMS_SENDER)
    private readonly smsSender: SmsSender,
  ) {}

  async request(rawPhone: string): Promise<PhoneCodeSentResult> {
    const phone = mobile(rawPhone);
    const now = new Date();
    const previous = await this.repository.findLatestByPhone(phone);
    if (previous && !previous.canBeReplaced(now)) {
      throw new TooManyRequestsError(
        'PHONE_CODE_RECENTLY_SENT',
        '인증 코드를 방금 보냈어요. 1분 뒤에 다시 받을 수 있어요.',
      );
    }
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    const verification = PhoneVerification.issue({
      id: randomUUID(),
      phone,
      codeHash: hashCode(phone, code),
      now,
    });
    await this.repository.insert(verification);
    await this.smsSender.sendVerificationCode(phone, code);
    return { expiresAt: verification.expiresAt };
  }

  async confirm(rawPhone: string, code: string): Promise<PhoneVerifiedResult> {
    const phone = mobile(rawPhone);
    const now = new Date();
    const latest = await this.repository.findLatestByPhone(phone);
    if (!latest || !latest.isCodeUsable(now)) {
      throw invalidCode();
    }
    if (latest.codeHash !== hashCode(phone, code.trim())) {
      await this.repository.recordFailedAttempt(latest.id);
      throw invalidCode();
    }
    const token = randomBytes(24).toString('base64url');
    await this.repository.markVerified(latest.id, hashToken(token), now);
    return {
      verificationToken: token,
      expiresAt: new Date(now.getTime() + 30 * 60 * 1000),
    };
  }

  /**
   * 가입에 인증 토큰을 쓴다. 토큰이 그 번호의 것이고, 아직 쓰지 않았고, 30분 안이어야 한다.
   * 한 번 쓰면 다시 쓸 수 없다.
   */
  async consume(token: string | undefined, rawPhone: string): Promise<void> {
    const phone = PhoneNumber.of(rawPhone).value;
    const now = new Date();
    const verification = token
      ? await this.repository.findByTokenHash(hashToken(token))
      : null;
    if (
      !verification ||
      verification.phone !== phone ||
      !verification.isTokenUsable(now) ||
      !(await this.repository.markUsed(verification.id, now))
    ) {
      throw new InvalidArgumentError(
        'PHONE_VERIFICATION_REQUIRED',
        '휴대폰 번호 인증을 다시 해 주세요.',
      );
    }
  }
}

/** 휴대폰 번호만 받는다 (안심번호·유선 번호는 문자를 받지 못한다). */
function mobile(raw: string): string {
  const phone = PhoneNumber.of(raw).value;
  if (!/^01[016789]\d{7,8}$/.test(phone)) {
    throw new InvalidArgumentError(
      'INVALID_MOBILE_PHONE',
      '휴대폰 번호를 확인해 주세요.',
    );
  }
  return phone;
}

/** 6자리라 그대로 해시하면 금방 찾아낸다. 번호를 섞는다. */
function hashCode(phone: string, code: string): string {
  return createHash('sha256').update(`${phone}:${code}`).digest('hex');
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function invalidCode(): InvalidArgumentError {
  return new InvalidArgumentError(
    'INVALID_PHONE_CODE',
    '인증 코드가 올바르지 않거나 만료됐어요. 코드를 다시 받아 주세요.',
  );
}
