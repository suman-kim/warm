import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import {
  DriverDocument,
  DriverDocumentStatus,
  DriverDocumentType,
} from '../../domain/entities/driver-document.entity.js';
import {
  DriverDocumentRepository,
  DriverLocationRepository,
  DriverShiftRepository,
  SettlementAccountRepository,
  StoredLocation,
} from '../../domain/repositories/driver-support.repositories.js';
import {
  AccountVerificationStatus,
  SettlementAccount,
} from '../../domain/value-objects.js';
import { DriverDocumentOrmEntity } from '../entities/driver-document.orm-entity.js';
import { DriverLocationOrmEntity } from '../entities/driver-location.orm-entity.js';
import { DriverShiftOrmEntity } from '../entities/driver-shift.orm-entity.js';
import { SettlementAccountOrmEntity } from '../entities/settlement-account.orm-entity.js';

/** 기사 서류 저장소 TypeORM 구현체. */
@Injectable()
export class DriverDocumentTypeormRepository implements DriverDocumentRepository {
  constructor(
    @InjectRepository(DriverDocumentOrmEntity)
    private readonly repository: Repository<DriverDocumentOrmEntity>,
  ) {}

  async save(document: DriverDocument): Promise<void> {
    await this.repository.upsert(
      {
        id: document.id,
        userId: document.userId,
        type: document.type,
        status: document.status,
        storageKey: document.storageKey,
        contentType: document.contentType,
        size: document.size,
        rejectionReason: document.rejectionReason,
        uploadedAt: document.uploadedAt,
        reviewedAt: document.reviewedAt,
      },
      ['userId', 'type'],
    );
  }

  async findByUserId(userId: string): Promise<DriverDocument[]> {
    const rows = await this.repository.find({ where: { userId } });
    return rows.map(toDocument);
  }

  async findByUserIds(userIds: string[]): Promise<DriverDocument[]> {
    if (userIds.length === 0) {
      return [];
    }
    const rows = await this.repository.find({ where: { userId: In(userIds) } });
    return rows.map(toDocument);
  }

  async findOne(
    userId: string,
    type: DriverDocumentType,
  ): Promise<DriverDocument | null> {
    const row = await this.repository.findOne({ where: { userId, type } });
    return row ? toDocument(row) : null;
  }
}

function toDocument(row: DriverDocumentOrmEntity): DriverDocument {
  return new DriverDocument(
    row.id,
    row.userId,
    row.type as DriverDocumentType,
    row.status as DriverDocumentStatus,
    row.storageKey,
    row.contentType,
    row.size,
    row.rejectionReason,
    row.uploadedAt,
    row.reviewedAt,
  );
}

/** 운행 기록 저장소 TypeORM 구현체. */
@Injectable()
export class DriverShiftTypeormRepository implements DriverShiftRepository {
  constructor(
    @InjectRepository(DriverShiftOrmEntity)
    private readonly repository: Repository<DriverShiftOrmEntity>,
  ) {}

  async start(driverId: string, at: Date): Promise<void> {
    if (await this.findOnlineSince(driverId)) {
      return;
    }
    await this.repository.insert({
      id: randomUUID(),
      driverId,
      startedAt: at,
      endedAt: null,
    });
  }

  async end(driverId: string, at: Date): Promise<void> {
    await this.repository.update(
      { driverId, endedAt: IsNull() },
      { endedAt: at },
    );
  }

  async findOnlineSince(driverId: string): Promise<Date | null> {
    const open = await this.repository.findOne({
      where: { driverId, endedAt: IsNull() },
      order: { startedAt: 'DESC' },
    });
    return open?.startedAt ?? null;
  }

  async onlineSecondsBetween(
    driverId: string,
    from: Date,
    to: Date,
  ): Promise<number> {
    // 기간과 겹치는 부분만 센다: 시작은 from보다 이르지 않게, 끝은 to보다 늦지 않게.
    const row = await this.repository
      .createQueryBuilder('s')
      .select(
        `COALESCE(SUM(EXTRACT(EPOCH FROM (
          LEAST(COALESCE(s.ended_at, :to), :to) - GREATEST(s.started_at, :from)
        ))), 0)`,
        'seconds',
      )
      .where('s.driver_id = :driverId', { driverId })
      .andWhere('s.started_at < :to')
      .andWhere('(s.ended_at IS NULL OR s.ended_at > :from)')
      .setParameters({ from, to })
      .getRawOne<{ seconds: string }>();
    return Math.max(0, Math.round(Number(row?.seconds ?? 0)));
  }
}

/** 기사 위치 저장소 TypeORM 구현체. */
@Injectable()
export class DriverLocationTypeormRepository implements DriverLocationRepository {
  constructor(
    @InjectRepository(DriverLocationOrmEntity)
    private readonly repository: Repository<DriverLocationOrmEntity>,
  ) {}

  async save(driverId: string, location: StoredLocation): Promise<void> {
    await this.repository.upsert({ driverId, ...location }, ['driverId']);
  }

  async find(driverId: string): Promise<StoredLocation | null> {
    const row = await this.repository.findOne({ where: { driverId } });
    return row
      ? {
          latitude: row.latitude,
          longitude: row.longitude,
          updatedAt: row.updatedAt,
        }
      : null;
  }

  async delete(driverId: string): Promise<void> {
    await this.repository.delete({ driverId });
  }
}

/** 정산 계좌 저장소 TypeORM 구현체. */
@Injectable()
export class SettlementAccountTypeormRepository implements SettlementAccountRepository {
  constructor(
    @InjectRepository(SettlementAccountOrmEntity)
    private readonly repository: Repository<SettlementAccountOrmEntity>,
  ) {}

  async save(driverId: string, account: SettlementAccount): Promise<void> {
    await this.repository.upsert(
      {
        driverId,
        bankName: account.bankName,
        accountNumber: account.accountNumber,
        accountHolder: account.accountHolder,
        verificationStatus: account.verification.status,
        verificationFailureReason: account.verification.failureReason,
        verificationAttemptedAt: account.verification.attemptedAt,
        verifiedAt: account.verification.verifiedAt,
      },
      ['driverId'],
    );
  }

  async find(driverId: string): Promise<SettlementAccount | null> {
    const row = await this.repository.findOne({ where: { driverId } });
    return row && toAccount(row);
  }

  async findByDriverIds(
    driverIds: string[],
  ): Promise<Map<string, SettlementAccount>> {
    if (driverIds.length === 0) {
      return new Map();
    }
    const rows = await this.repository.find({
      where: { driverId: In(driverIds) },
    });
    return new Map(rows.map((row) => [row.driverId, toAccount(row)]));
  }
}

function toAccount(row: SettlementAccountOrmEntity): SettlementAccount {
  return SettlementAccount.of(row, {
    status: row.verificationStatus as AccountVerificationStatus,
    failureReason: row.verificationFailureReason,
    attemptedAt: row.verificationAttemptedAt,
    verifiedAt: row.verifiedAt,
  });
}
