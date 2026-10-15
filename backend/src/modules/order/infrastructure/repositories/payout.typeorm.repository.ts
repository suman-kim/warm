import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConflictError } from '../../../../common/domain/domain-error.js';
import { Paged, PageRequest } from '../../../../common/domain/pagination.js';
import { isUniqueViolation } from '../../../../common/infrastructure/persistence/persist-aggregate.js';
import { Payout } from '../../domain/entities/payout.entity.js';
import { PayoutRepository } from '../../domain/repositories/payout.repository.js';
import { PayoutOrmEntity } from '../entities/payout.orm-entity.js';

/** 지급 기록 저장소 TypeORM 구현체. */
@Injectable()
export class PayoutTypeormRepository implements PayoutRepository {
  constructor(
    @InjectRepository(PayoutOrmEntity)
    private readonly repository: Repository<PayoutOrmEntity>,
  ) {}

  async saveAll(payouts: Payout[]): Promise<void> {
    try {
      // 한 문장으로 넣어, 하나라도 겹치면 전부 들어가지 않게 한다.
      await this.repository.insert(payouts.map(toRow));
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictError(
          'SETTLEMENT_ALREADY_PAID',
          '이미 지급 처리한 정산이 있어요. 목록을 새로 고쳐 주세요.',
        );
      }
      throw error;
    }
  }

  async update(payout: Payout): Promise<void> {
    await this.repository.update(
      { id: payout.id },
      {
        status: payout.status,
        failureReason: payout.failureReason,
        completedAt: payout.completedAt,
      },
    );
  }

  async findByWeek(weekStart: Date): Promise<Payout[]> {
    const rows = await this.repository.find({
      where: { weekStart },
      order: { paidAt: 'ASC', id: 'ASC' },
    });
    return rows.map(toPayout);
  }

  async findByDriver(driverId: string, limit: number): Promise<Payout[]> {
    const rows = await this.repository.find({
      where: { driverId },
      order: { weekStart: 'DESC', paidAt: 'DESC' },
      take: limit,
    });
    return rows.map(toPayout);
  }

  async findPage(page: PageRequest): Promise<Paged<Payout>> {
    const [rows, total] = await this.repository.findAndCount({
      order: { paidAt: 'DESC', id: 'ASC' },
      skip: page.offset,
      take: page.limit,
    });
    return { items: rows.map(toPayout), total };
  }
}

function toRow(payout: Payout): PayoutOrmEntity {
  return {
    id: payout.id,
    driverId: payout.driverId,
    weekStart: payout.weekStart,
    ...payout.amounts,
    bankName: payout.bankName,
    maskedAccountNumber: payout.maskedAccountNumber,
    status: payout.status,
    failureReason: payout.failureReason,
    paidAt: payout.paidAt,
    completedAt: payout.completedAt,
    paidBy: payout.paidBy,
  };
}

function toPayout(row: PayoutOrmEntity): Payout {
  return new Payout(
    row.id,
    row.driverId,
    row.weekStart,
    {
      trips: row.trips,
      gross: row.gross,
      extraFare: row.extraFare,
      fee: row.fee,
      compensation: row.compensation,
      net: row.net,
    },
    row.bankName,
    row.maskedAccountNumber,
    row.paidAt,
    row.paidBy,
    row.status,
    row.failureReason,
    row.completedAt,
  );
}
