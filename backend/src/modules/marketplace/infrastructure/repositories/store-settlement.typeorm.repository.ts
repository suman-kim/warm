import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import { Paged, PageRequest } from '../../../../common/domain/pagination.js';
import { isUniqueViolation } from '../../../../common/infrastructure/persistence/persist-aggregate.js';
import { StoreOrmEntity } from '../../../store/infrastructure/entities/store.orm-entity.js';
import {
  DueStoreSettlement,
  StoreSettlementRepository,
} from '../../domain/repositories/marketplace.repositories.js';
import {
  StorePayout,
  StoreSettlementAccount,
  StoreSettlementEntry,
  StoreSettlementEntryKind,
  StoreSettlementHold,
} from '../../domain/services/store-settlement.js';
import {
  StorePayoutOrmEntity,
  StoreSettlementAccountOrmEntity,
  StoreSettlementEntryOrmEntity,
  StoreSettlementHoldOrmEntity,
} from '../entities/store-settlement.orm-entity.js';

@Injectable()
export class StoreSettlementTypeormRepository implements StoreSettlementRepository {
  constructor(
    @InjectRepository(StoreSettlementEntryOrmEntity)
    private readonly entries: Repository<StoreSettlementEntryOrmEntity>,
    @InjectRepository(StorePayoutOrmEntity)
    private readonly payouts: Repository<StorePayoutOrmEntity>,
    @InjectRepository(StoreSettlementAccountOrmEntity)
    private readonly accounts: Repository<StoreSettlementAccountOrmEntity>,
    @InjectRepository(StoreSettlementHoldOrmEntity)
    private readonly holds: Repository<StoreSettlementHoldOrmEntity>,
  ) {}

  async addEntry(entry: StoreSettlementEntry): Promise<void> {
    try {
      await this.entries.insert({ ...entry });
    } catch (error) {
      // 같은 주문의 같은 내역(SALE·CANCELLATION_FEE)은 한 번만 — 이벤트가 겹쳐 와도 조용히 넘어간다.
      if (!isUniqueViolation(error)) throw error;
    }
  }

  async hasEntry(foodOrderId: string, kind: string): Promise<boolean> {
    return (await this.entries.count({ where: { foodOrderId, kind } })) > 0;
  }

  async findEntries(
    storeId: string,
    filter: { from?: Date; to?: Date },
    page: PageRequest,
  ): Promise<Paged<StoreSettlementEntry>> {
    const query = this.entries
      .createQueryBuilder('e')
      .where('e.store_id = :storeId', { storeId });
    if (filter.from)
      query.andWhere('e.created_at >= :from', { from: filter.from });
    if (filter.to) query.andWhere('e.created_at < :to', { to: filter.to });
    const [rows, total] = await query
      .orderBy('e.created_at', 'DESC')
      .addOrderBy('e.id', 'DESC')
      .offset(page.offset)
      .limit(page.limit)
      .getManyAndCount();
    return { items: rows.map(toEntry), total };
  }

  async unpaidByDueOn(
    storeId: string,
  ): Promise<{ dueOn: string; amount: number; entryCount: number }[]> {
    const rows = await this.entries
      .createQueryBuilder('e')
      .select(`to_char(e.payout_due_on, 'YYYY-MM-DD')`, 'dueOn')
      .addSelect('SUM(e.amount)', 'amount')
      .addSelect('COUNT(*)', 'entryCount')
      .where('e.store_id = :storeId', { storeId })
      .andWhere('e.payout_id IS NULL')
      .groupBy('e.payout_due_on')
      .orderBy('e.payout_due_on', 'ASC')
      .getRawMany<{ dueOn: string; amount: string; entryCount: string }>();
    return rows.map((row) => ({
      dueOn: row.dueOn,
      amount: Number(row.amount),
      entryCount: Number(row.entryCount),
    }));
  }

  async due(asOf: string): Promise<DueStoreSettlement[]> {
    const rows = await this.entries
      .createQueryBuilder('e')
      .innerJoin(StoreOrmEntity, 's', 's.id = e.store_id')
      .select('e.store_id', 'storeId')
      .addSelect('s.name', 'storeName')
      .addSelect('SUM(e.amount)', 'amount')
      .addSelect('COUNT(*)', 'entryCount')
      .addSelect(`to_char(MIN(e.payout_due_on), 'YYYY-MM-DD')`, 'earliestDueOn')
      .where('e.payout_id IS NULL')
      .andWhere('e.payout_due_on <= :asOf', { asOf })
      .groupBy('e.store_id')
      .addGroupBy('s.name')
      .orderBy('MIN(e.payout_due_on)', 'ASC')
      .addOrderBy('s.name', 'ASC')
      .getRawMany<{
        storeId: string;
        storeName: string;
        amount: string;
        entryCount: string;
        earliestDueOn: string;
      }>();
    return rows.map((row) => ({
      storeId: row.storeId,
      storeName: row.storeName,
      amount: Number(row.amount),
      entryCount: Number(row.entryCount),
      earliestDueOn: row.earliestDueOn,
    }));
  }

  /** 묶을 내역을 잠그고 지급 하나로 묶는다 — 두 운영자가 동시에 눌러도 한 번만 지급된다. */
  async pay(
    payout: Omit<StorePayout, 'amount' | 'entryCount'>,
    asOf: string,
  ): Promise<StorePayout> {
    return this.entries.manager.transaction(async (manager) => {
      const rows = await manager
        .getRepository(StoreSettlementEntryOrmEntity)
        .createQueryBuilder('e')
        .setLock('pessimistic_write')
        .where('e.store_id = :storeId', { storeId: payout.storeId })
        .andWhere('e.payout_id IS NULL')
        .andWhere('e.payout_due_on <= :asOf', { asOf })
        .getMany();
      const saved: StorePayout = {
        ...payout,
        amount: rows.reduce((sum, row) => sum + row.amount, 0),
        entryCount: rows.length,
      };
      if (rows.length === 0 || saved.amount <= 0) return saved;
      await manager.getRepository(StorePayoutOrmEntity).insert({ ...saved });
      await manager
        .getRepository(StoreSettlementEntryOrmEntity)
        .update(
          { id: In(rows.map((row) => row.id)), payoutId: IsNull() },
          { payoutId: payout.id },
        );
      return saved;
    });
  }

  async findPayouts(
    filter: { storeId?: string },
    page: PageRequest,
  ): Promise<Paged<StorePayout>> {
    const [rows, total] = await this.payouts.findAndCount({
      where: filter.storeId ? { storeId: filter.storeId } : {},
      order: { paidAt: 'DESC', id: 'DESC' },
      skip: page.offset,
      take: page.limit,
    });
    return { items: rows.map((row) => ({ ...row })), total };
  }

  async findAccount(storeId: string): Promise<StoreSettlementAccount | null> {
    const row = await this.accounts.findOne({ where: { storeId } });
    return row ? { ...row } : null;
  }

  async findAccounts(
    storeIds: string[],
  ): Promise<Map<string, StoreSettlementAccount>> {
    if (storeIds.length === 0) return new Map();
    const rows = await this.accounts.find({ where: { storeId: In(storeIds) } });
    return new Map(rows.map((row) => [row.storeId, { ...row }]));
  }

  async saveAccount(account: StoreSettlementAccount): Promise<void> {
    await this.accounts.save(
      Object.assign(new StoreSettlementAccountOrmEntity(), account),
    );
  }

  async findHolds(
    storeIds: string[],
  ): Promise<Map<string, StoreSettlementHold>> {
    if (storeIds.length === 0) return new Map();
    const rows = await this.holds.find({ where: { storeId: In(storeIds) } });
    return new Map(rows.map((row) => [row.storeId, { ...row }]));
  }

  async saveHold(hold: StoreSettlementHold): Promise<void> {
    await this.holds.save(
      Object.assign(new StoreSettlementHoldOrmEntity(), hold),
    );
  }

  async deleteHold(storeId: string): Promise<void> {
    await this.holds.delete({ storeId });
  }
}

function toEntry(row: StoreSettlementEntryOrmEntity): StoreSettlementEntry {
  return { ...row, kind: row.kind as StoreSettlementEntryKind };
}
