import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Paged, PageRequest } from '../../../../common/domain/pagination.js';
import {
  boundingBox,
  distanceKmSql,
} from '../../../../common/infrastructure/persistence/geo-sql.js';
import { persistAggregate } from '../../../../common/infrastructure/persistence/persist-aggregate.js';
import { DriverStatus } from '../../domain/driver-status.js';
import { Driver } from '../../domain/entities/driver.entity.js';
import { DriverRepository } from '../../domain/repositories/driver.repository.js';
import { DriverLocationOrmEntity } from '../entities/driver-location.orm-entity.js';
import { DriverOrmEntity } from '../entities/driver.orm-entity.js';
import { DriverMapper } from '../mappers/driver.mapper.js';

/** 기사 저장소 TypeORM 구현체. */
@Injectable()
export class DriverTypeormRepository implements DriverRepository {
  constructor(
    @InjectRepository(DriverOrmEntity)
    private readonly repository: Repository<DriverOrmEntity>,
  ) {}

  async save(driver: Driver): Promise<void> {
    await persistAggregate(this.repository, driver, DriverMapper.toOrm(driver));
  }

  async findById(id: string): Promise<Driver | null> {
    const row = await this.repository.findOne({ where: { id } });
    return row ? DriverMapper.toDomain(row) : null;
  }

  async findByIds(ids: string[]): Promise<Driver[]> {
    if (ids.length === 0) {
      return [];
    }
    const rows = await this.repository.find({ where: { id: In(ids) } });
    return rows.map((row) => DriverMapper.toDomain(row));
  }

  async findByUserId(userId: string): Promise<Driver | null> {
    const row = await this.repository.findOne({ where: { userId } });
    return row ? DriverMapper.toDomain(row) : null;
  }

  async findAvailableUserIdsNear(
    near: { latitude: number; longitude: number; radiusKm: number },
    freshSince: Date,
  ): Promise<string[]> {
    const box = boundingBox(near.latitude, near.longitude, near.radiusKm);
    const rows = await this.repository
      .createQueryBuilder('d')
      .select('d.user_id', 'userId')
      .innerJoin(DriverLocationOrmEntity, 'l', 'l.driver_id = d.id')
      .where('d.status = :status', { status: DriverStatus.APPROVED })
      .andWhere('d.available = true')
      .andWhere('l.updated_at >= :freshSince', { freshSince })
      .andWhere('l.latitude BETWEEN :minLat AND :maxLat', box)
      .andWhere('l.longitude BETWEEN :minLng AND :maxLng', box)
      .andWhere(`${distanceKmSql('l.latitude', 'l.longitude')} <= :radiusKm`, {
        radiusKm: near.radiusKm,
      })
      .setParameters({ lat: near.latitude, lng: near.longitude })
      .getRawMany<{ userId: string }>();
    return rows.map((row) => row.userId);
  }

  async findAll(
    filter: { status?: DriverStatus },
    page: PageRequest,
  ): Promise<Paged<Driver>> {
    const [rows, total] = await this.repository.findAndCount({
      where: filter.status ? { status: filter.status } : {},
      order: { createdAt: 'ASC' },
      skip: page.offset,
      take: page.limit,
    });
    return { items: rows.map((row) => DriverMapper.toDomain(row)), total };
  }
}
