import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { MarketplacePolicy } from '../../domain/marketplace-policy.js';
import {
  PolicyChange,
  PolicyRepository,
  StoredPolicy,
} from '../../domain/policy.repository.js';
import {
  PlatformPolicyChangeOrmEntity,
  PlatformPolicyOrmEntity,
} from '../entities/platform-policy.orm-entity.js';

const MARKETPLACE = 'MARKETPLACE';

/** 정책 저장소 TypeORM 구현체. */
@Injectable()
export class PolicyTypeormRepository implements PolicyRepository {
  constructor(
    @InjectRepository(PlatformPolicyOrmEntity)
    private readonly policies: Repository<PlatformPolicyOrmEntity>,
    @InjectRepository(PlatformPolicyChangeOrmEntity)
    private readonly changes: Repository<PlatformPolicyChangeOrmEntity>,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  async findMarketplace(): Promise<StoredPolicy<
    Partial<MarketplacePolicy>
  > | null> {
    const row = await this.policies.findOneBy({ key: MARKETPLACE });
    return row
      ? {
          value: row.value as Partial<MarketplacePolicy>,
          updatedAt: row.updatedAt,
          updatedBy: row.updatedBy,
        }
      : null;
  }

  async saveMarketplace(
    policy: MarketplacePolicy,
    adminId: string,
    now: Date,
  ): Promise<void> {
    const value = { ...policy } as Record<string, unknown>;
    await this.dataSource.transaction(async (manager) => {
      await manager.save(
        Object.assign(new PlatformPolicyOrmEntity(), {
          key: MARKETPLACE,
          value,
          updatedAt: now,
          updatedBy: adminId,
        }),
      );
      await manager.save(
        Object.assign(new PlatformPolicyChangeOrmEntity(), {
          id: randomUUID(),
          key: MARKETPLACE,
          value,
          changedAt: now,
          changedBy: adminId,
        }),
      );
    });
  }

  async marketplaceHistory(
    limit: number,
  ): Promise<PolicyChange<MarketplacePolicy>[]> {
    const rows = await this.changes.find({
      where: { key: MARKETPLACE },
      order: { changedAt: 'DESC' },
      take: limit,
    });
    return rows.map((row) => ({
      id: row.id,
      value: row.value as unknown as MarketplacePolicy,
      changedAt: row.changedAt,
      changedBy: row.changedBy,
    }));
  }
}
