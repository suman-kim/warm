import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import { Paged, PageRequest } from '../../../../common/domain/pagination.js';
import { persistAggregate } from '../../../../common/infrastructure/persistence/persist-aggregate.js';
import {
  Store,
  StoreStatus,
  WalletEntry,
  WalletEntryKind,
} from '../../domain/store.entity.js';
import {
  StoreRepository,
  StoreWalletRow,
} from '../../domain/store.repository.js';
import {
  StoreOrmEntity,
  WalletEntryOrmEntity,
} from '../entities/store.orm-entity.js';

/** 가게 저장소 TypeORM 구현체. 가게(잔액)와 새 충전금 내역을 한 트랜잭션으로 저장한다. */
@Injectable()
export class StoreTypeormRepository implements StoreRepository {
  constructor(
    @InjectRepository(StoreOrmEntity)
    private readonly stores: Repository<StoreOrmEntity>,
    @InjectRepository(WalletEntryOrmEntity)
    private readonly entries: Repository<WalletEntryOrmEntity>,
  ) {}

  async save(store: Store): Promise<void> {
    const entries = store.pullNewEntries();
    await this.stores.manager.transaction(async (manager) => {
      await persistAggregate(
        manager.getRepository(StoreOrmEntity),
        store,
        toOrm(store),
      );
      if (entries.length > 0) {
        await manager
          .getRepository(WalletEntryOrmEntity)
          .insert(entries.map((entry) => ({ ...entry })));
      }
    });
  }

  async findById(id: string): Promise<Store | null> {
    const row = await this.stores.findOne({ where: { id } });
    return row ? toDomain(row) : null;
  }

  async findByOwner(ownerUserId: string): Promise<Store | null> {
    const row = await this.stores.findOne({ where: { ownerUserId } });
    return row ? toDomain(row) : null;
  }

  async findAll(
    filter: { status?: StoreStatus; q?: string },
    page: PageRequest,
  ): Promise<Paged<Store>> {
    const query = this.stores.createQueryBuilder('s');
    if (filter.status) {
      query.andWhere('s.status = :status', { status: filter.status });
    }
    const q = filter.q?.trim();
    if (q) {
      query.andWhere(
        new Brackets((where) =>
          where
            .where('s.name ILIKE :q', { q: `%${q}%` })
            .orWhere('s.business_number LIKE :digits', {
              digits: `%${q.replace(/\D/g, '') || q}%`,
            }),
        ),
      );
    }
    query.orderBy(
      's.applied_at',
      filter.status === StoreStatus.PENDING ? 'ASC' : 'DESC',
    );
    const [rows, total] = await query
      .offset(page.offset)
      .limit(page.limit)
      .getManyAndCount();
    return { items: rows.map(toDomain), total };
  }

  async countByStatus(): Promise<Record<StoreStatus, number>> {
    const rows = await this.stores
      .createQueryBuilder('s')
      .select('s.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('s.status')
      .getRawMany<{ status: StoreStatus; count: string }>();
    const counts = Object.fromEntries(
      Object.values(StoreStatus).map((status) => [status, 0]),
    ) as Record<StoreStatus, number>;
    for (const row of rows) counts[row.status] = Number(row.count);
    return counts;
  }

  async findEntries(
    storeId: string,
    page: PageRequest,
  ): Promise<Paged<WalletEntry>> {
    const [rows, total] = await this.entries.findAndCount({
      where: { storeId },
      order: { createdAt: 'DESC', id: 'DESC' },
      skip: page.offset,
      take: page.limit,
    });
    return {
      items: rows.map((row) => ({
        id: row.id,
        storeId: row.storeId,
        kind: row.kind as WalletEntryKind,
        amount: row.amount,
        balanceAfter: row.balanceAfter,
        orderId: row.orderId,
        memo: row.memo,
        createdBy: row.createdBy,
        createdAt: row.createdAt,
      })),
      total,
    };
  }

  async walletOverview(since: Date): Promise<StoreWalletRow[]> {
    const rows = await this.stores.query<
      {
        id: string;
        name: string;
        wallet_balance: number;
        top_ups: string;
        fees: string;
        last_kind: string | null;
        last_at: Date | null;
      }[]
    >(
      `SELECT s.id, s.name, s.wallet_balance,
         COALESCE(SUM(e.amount) FILTER (WHERE e.kind = 'TOP_UP' AND e.created_at >= $1), 0) AS top_ups,
         COALESCE(-SUM(e.amount) FILTER (WHERE e.kind IN ('DELIVERY_FEE', 'REFUND') AND e.created_at >= $1), 0) AS fees,
         last.kind AS last_kind, last.created_at AS last_at
       FROM stores s
       LEFT JOIN store_wallet_entries e ON e.store_id = s.id
       LEFT JOIN LATERAL (
         SELECT l.kind, l.created_at FROM store_wallet_entries l
         WHERE l.store_id = s.id ORDER BY l.created_at DESC LIMIT 1
       ) last ON true
       WHERE s.status = $2
       GROUP BY s.id, last.kind, last.created_at
       ORDER BY s.wallet_balance ASC, s.name ASC`,
      [since, StoreStatus.APPROVED],
    );
    return rows.map((row) => ({
      storeId: row.id,
      name: row.name,
      balance: Number(row.wallet_balance),
      topUpsSince: Number(row.top_ups),
      feesSince: Number(row.fees),
      lastEntryKind: row.last_kind as WalletEntryKind | null,
      lastEntryAt: row.last_at,
    }));
  }
}

function toOrm(store: Store): StoreOrmEntity {
  const s = store.snapshot();
  return {
    id: s.id,
    ownerUserId: s.ownerUserId,
    name: s.name,
    businessNumber: s.businessNumber,
    phone: s.phone,
    address: s.address.address,
    detailAddress: s.address.detailAddress,
    sigungu: s.address.sigungu,
    dong: s.address.dong,
    latitude: s.address.latitude,
    longitude: s.address.longitude,
    status: s.status,
    rejectionReason: s.rejectionReason,
    walletBalance: s.walletBalance,
    appliedAt: s.appliedAt,
    reviewedAt: s.reviewedAt,
    reviewedBy: s.reviewedBy,
    createdAt: s.createdAt,
    version: store.version,
  };
}

function toDomain(row: StoreOrmEntity): Store {
  return Store.restore(
    {
      id: row.id,
      ownerUserId: row.ownerUserId,
      name: row.name,
      businessNumber: row.businessNumber,
      phone: row.phone,
      address: {
        address: row.address,
        detailAddress: row.detailAddress,
        sigungu: row.sigungu,
        dong: row.dong,
        latitude: row.latitude,
        longitude: row.longitude,
      },
      status: row.status as StoreStatus,
      rejectionReason: row.rejectionReason,
      walletBalance: row.walletBalance,
      appliedAt: row.appliedAt,
      reviewedAt: row.reviewedAt,
      reviewedBy: row.reviewedBy,
      createdAt: row.createdAt,
    },
    row.version,
  );
}
