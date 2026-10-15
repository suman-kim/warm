import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PasswordResetCode } from '../../domain/entities/password-reset-code.entity.js';
import { PasswordResetCodeRepository } from '../../domain/repositories/password-reset-code.repository.js';
import { PasswordResetCodeOrmEntity } from '../entities/password-reset-code.orm-entity.js';

/** 비밀번호 재설정 코드 저장소 TypeORM 구현체. */
@Injectable()
export class PasswordResetCodeTypeormRepository implements PasswordResetCodeRepository {
  constructor(
    @InjectRepository(PasswordResetCodeOrmEntity)
    private readonly repository: Repository<PasswordResetCodeOrmEntity>,
  ) {}

  async replaceForUser(code: PasswordResetCode): Promise<void> {
    await this.repository.upsert({ ...code }, ['userId']);
  }

  async findByUserId(userId: string): Promise<PasswordResetCode | null> {
    const row = await this.repository.findOne({ where: { userId } });
    return row
      ? new PasswordResetCode(
          row.id,
          row.userId,
          row.codeHash,
          row.expiresAt,
          row.attempts,
          row.usedAt,
          row.createdAt,
        )
      : null;
  }

  async recordFailedAttempt(id: string): Promise<void> {
    await this.repository.increment({ id }, 'attempts', 1);
  }

  async markUsed(id: string, now: Date): Promise<void> {
    await this.repository.update({ id }, { usedAt: now });
  }
}
