import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { PhoneVerification } from '../../domain/entities/phone-verification.entity.js';
import { PhoneVerificationRepository } from '../../domain/repositories/phone-verification.repository.js';
import { PhoneVerificationOrmEntity } from '../entities/phone-verification.orm-entity.js';

/** 휴대폰 인증 저장소 TypeORM 구현체. */
@Injectable()
export class PhoneVerificationTypeormRepository implements PhoneVerificationRepository {
  constructor(
    @InjectRepository(PhoneVerificationOrmEntity)
    private readonly repository: Repository<PhoneVerificationOrmEntity>,
  ) {}

  async findLatestByPhone(phone: string): Promise<PhoneVerification | null> {
    const row = await this.repository.findOne({
      where: { phone },
      order: { createdAt: 'DESC' },
    });
    return row ? toDomain(row) : null;
  }

  async findByTokenHash(tokenHash: string): Promise<PhoneVerification | null> {
    const row = await this.repository.findOneBy({ tokenHash });
    return row ? toDomain(row) : null;
  }

  async insert(verification: PhoneVerification): Promise<void> {
    await this.repository.insert({ ...verification });
  }

  async recordFailedAttempt(id: string): Promise<void> {
    await this.repository.increment({ id }, 'attempts', 1);
  }

  async markVerified(id: string, tokenHash: string, at: Date): Promise<void> {
    await this.repository.update({ id }, { verifiedAt: at, tokenHash });
  }

  async markUsed(id: string, at: Date): Promise<boolean> {
    const result = await this.repository.update(
      { id, usedAt: IsNull() },
      { usedAt: at },
    );
    return (result.affected ?? 0) > 0;
  }
}

function toDomain(row: PhoneVerificationOrmEntity): PhoneVerification {
  return new PhoneVerification(
    row.id,
    row.phone,
    row.codeHash,
    row.expiresAt,
    row.attempts,
    row.verifiedAt,
    row.tokenHash,
    row.usedAt,
    row.createdAt,
  );
}
