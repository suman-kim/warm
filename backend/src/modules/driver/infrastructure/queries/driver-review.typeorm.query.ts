import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import { Paged, PageRequest } from '../../../../common/domain/pagination.js';
import {
  DriverReviewFilter,
  DriverReviewQuery,
} from '../../application/ports/driver-review.query.js';
import { DriverStatus } from '../../domain/driver-status.js';
import { Driver } from '../../domain/entities/driver.entity.js';
import { DriverOrmEntity } from '../entities/driver.orm-entity.js';
import { DriverMapper } from '../mappers/driver.mapper.js';

/** 기사 심사 목록 조회 TypeORM 구현체. */
@Injectable()
export class DriverReviewTypeormQuery implements DriverReviewQuery {
  constructor(
    @InjectRepository(DriverOrmEntity)
    private readonly repository: Repository<DriverOrmEntity>,
  ) {}

  async find(
    filter: DriverReviewFilter,
    page: PageRequest,
  ): Promise<Paged<Driver>> {
    const query = this.repository
      .createQueryBuilder('driver')
      .innerJoin('users', 'applicant', 'applicant.id = driver.user_id');
    if (filter.status) {
      query.andWhere('driver.status = :status', { status: filter.status });
    }
    const keyword = filter.q?.trim();
    if (keyword) {
      // 휴대폰 번호와 차량 번호는 숫자·글자만 저장한다 — 검색어의 하이픈과 공백을 뺀다.
      const compact = keyword.replace(/[-\s]/g, '');
      query.andWhere(
        new Brackets((where) =>
          where
            .where('applicant.name ILIKE :keyword')
            .orWhere('applicant.email ILIKE :keyword')
            .orWhere('applicant.phone LIKE :compact')
            .orWhere('driver.vehicle_number ILIKE :compact'),
        ),
        { keyword: contains(keyword), compact: contains(compact) },
      );
    }
    if (filter.status === DriverStatus.PENDING) {
      query.orderBy('driver.appliedAt', 'ASC');
    } else {
      query.orderBy('driver.reviewedAt', 'DESC', 'NULLS LAST');
    }
    const [rows, total] = await query
      .addOrderBy('driver.id', 'ASC')
      .skip(page.offset)
      .take(page.limit)
      .getManyAndCount();
    return { items: rows.map((row) => DriverMapper.toDomain(row)), total };
  }

  async countByStatus(): Promise<Record<DriverStatus, number>> {
    const rows = await this.repository
      .createQueryBuilder('driver')
      .select('driver.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('driver.status')
      .getRawMany<{ status: DriverStatus; count: string }>();
    const counts = {
      [DriverStatus.PENDING]: 0,
      [DriverStatus.APPROVED]: 0,
      [DriverStatus.REJECTED]: 0,
    };
    for (const row of rows) {
      counts[row.status] = Number(row.count);
    }
    return counts;
  }
}

/** LIKE 패턴으로 쓸 수 있게 %, _, \ 를 글자 그대로 찾도록 바꾼다. */
function contains(text: string): string {
  return `%${text.replace(/[\\%_]/g, '\\$&')}%`;
}
