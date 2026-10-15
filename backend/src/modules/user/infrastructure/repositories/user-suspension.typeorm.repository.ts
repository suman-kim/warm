import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserSuspension } from '../../domain/entities/user-suspension.entity.js';
import { UserSuspensionRepository } from '../../domain/repositories/user-suspension.repository.js';
import { UserSuspensionOrmEntity } from '../entities/user-suspension.orm-entity.js';

/** 회원 정지 기록 저장소 TypeORM 구현체. */
@Injectable()
export class UserSuspensionTypeormRepository implements UserSuspensionRepository {
  constructor(
    @InjectRepository(UserSuspensionOrmEntity)
    private readonly repository: Repository<UserSuspensionOrmEntity>,
  ) {}

  async save(suspension: UserSuspension): Promise<void> {
    await this.repository.save({
      id: suspension.id,
      userId: suspension.userId,
      reason: suspension.reason,
      suspendedBy: suspension.suspendedBy,
      startedAt: suspension.startedAt,
      endsAt: suspension.endsAt,
      liftedAt: suspension.liftedAt,
    });
  }

  async findByUserId(userId: string): Promise<UserSuspension[]> {
    const rows = await this.repository.find({
      where: { userId },
      order: { startedAt: 'DESC' },
    });
    return rows.map(
      (row) =>
        new UserSuspension(
          row.id,
          row.userId,
          row.reason,
          row.suspendedBy,
          row.startedAt,
          row.endsAt,
          row.liftedAt,
        ),
    );
  }
}
