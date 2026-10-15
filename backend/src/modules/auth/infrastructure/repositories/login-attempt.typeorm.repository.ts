import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LoginAttempt } from '../../domain/entities/login-attempt.entity.js';
import { LoginAttemptRepository } from '../../domain/repositories/login-attempt.repository.js';
import { LoginAttemptOrmEntity } from '../entities/login-attempt.orm-entity.js';

/** 로그인 실패 기록 저장소 TypeORM 구현체. */
@Injectable()
export class LoginAttemptTypeormRepository implements LoginAttemptRepository {
  constructor(
    @InjectRepository(LoginAttemptOrmEntity)
    private readonly repository: Repository<LoginAttemptOrmEntity>,
  ) {}

  async find(email: string): Promise<LoginAttempt | null> {
    const row = await this.repository.findOne({ where: { email } });
    return row
      ? new LoginAttempt(
          row.email,
          row.failures,
          row.windowStartedAt,
          row.lockedUntil,
        )
      : null;
  }

  async save(attempt: LoginAttempt): Promise<void> {
    await this.repository.upsert(
      {
        email: attempt.email,
        failures: attempt.failures,
        windowStartedAt: attempt.windowStartedAt,
        lockedUntil: attempt.lockedUntil,
      },
      ['email'],
    );
  }

  async delete(email: string): Promise<void> {
    await this.repository.delete({ email });
  }
}
