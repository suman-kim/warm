import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { persistAggregate } from '../../../../common/infrastructure/persistence/persist-aggregate.js';
import { AdminRole } from '../../domain/admin-role.js';
import {
  AdminAccount,
  AdminStatus,
} from '../../domain/entities/admin-account.entity.js';
import { AdminAccountRepository } from '../../domain/repositories/admin-account.repository.js';
import { AdminAccountOrmEntity } from '../entities/admin-account.orm-entity.js';

/** 운영자 계정 저장소 TypeORM 구현체. */
@Injectable()
export class AdminAccountTypeormRepository implements AdminAccountRepository {
  constructor(
    @InjectRepository(AdminAccountOrmEntity)
    private readonly repository: Repository<AdminAccountOrmEntity>,
  ) {}

  async save(account: AdminAccount): Promise<void> {
    const state = account.snapshot();
    const row = new AdminAccountOrmEntity();
    row.id = state.id;
    row.role = state.role;
    row.status = state.status;
    row.invitationTokenHash = state.invitationTokenHash;
    row.invitationExpiresAt = state.invitationExpiresAt;
    row.lastLoginAt = state.lastLoginAt;
    row.createdAt = state.createdAt;
    await persistAggregate(this.repository, account, row);
  }

  async findById(userId: string): Promise<AdminAccount | null> {
    const row = await this.repository.findOne({ where: { id: userId } });
    return row ? toDomain(row) : null;
  }

  async findByInvitationTokenHash(
    tokenHash: string,
  ): Promise<AdminAccount | null> {
    const row = await this.repository.findOne({
      where: { invitationTokenHash: tokenHash },
    });
    return row ? toDomain(row) : null;
  }

  async findAll(): Promise<AdminAccount[]> {
    const rows = await this.repository.find({
      order: { createdAt: 'ASC', id: 'ASC' },
    });
    return rows.map(toDomain);
  }

  countActiveSupers(): Promise<number> {
    return this.repository.count({
      where: { role: AdminRole.SUPER, status: AdminStatus.ACTIVE },
    });
  }
}

function toDomain(row: AdminAccountOrmEntity): AdminAccount {
  return AdminAccount.restore(
    {
      id: row.id,
      role: row.role as AdminRole,
      status: row.status as AdminStatus,
      invitationTokenHash: row.invitationTokenHash,
      invitationExpiresAt: row.invitationExpiresAt,
      lastLoginAt: row.lastLoginAt,
      createdAt: row.createdAt,
    },
    row.version,
  );
}
