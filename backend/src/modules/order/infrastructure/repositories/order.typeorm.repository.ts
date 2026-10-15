import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, In, Repository, SelectQueryBuilder } from 'typeorm';
import { Paged, PageRequest } from '../../../../common/domain/pagination.js';
import { VehicleType } from '../../../../common/domain/vehicle-type.js';
import {
  boundingBox,
  distanceKmSql,
} from '../../../../common/infrastructure/persistence/geo-sql.js';
import { persistAggregate } from '../../../../common/infrastructure/persistence/persist-aggregate.js';
import { Order } from '../../domain/entities/order.entity.js';
import {
  IN_PROGRESS_STATUSES,
  OrderStatus,
  UNFINISHED_STATUSES,
} from '../../domain/order-status.js';
import {
  OrderFilter,
  OrderRepository,
  Period,
  SettlementEntry,
} from '../../domain/repositories/order.repository.js';
import { OrderOrmEntity } from '../entities/order.orm-entity.js';
import { OrderMapper } from '../mappers/order.mapper.js';

/** 기사 쪽에서 본 주문의 시각: 끝났으면 끝난 때, 아니면 배차된 때. */
const DRIVER_ACTIVITY_AT =
  'COALESCE(o.delivered_at, o.cancelled_at, o.no_show_at, o.assigned_at, o.requested_at)';

/** 기사의 수입에 들어가는, 끝난 주문 (배송 완료, 고객 취소, 노쇼). */
const FINISHED_FOR_DRIVER = [
  OrderStatus.DELIVERED,
  OrderStatus.CANCELLED,
  OrderStatus.NO_SHOW,
];

/** 주문 저장소 TypeORM 구현체. */
@Injectable()
export class OrderTypeormRepository implements OrderRepository {
  constructor(
    @InjectRepository(OrderOrmEntity)
    private readonly repository: Repository<OrderOrmEntity>,
  ) {}

  async save(order: Order): Promise<void> {
    await persistAggregate(this.repository, order, OrderMapper.toOrm(order));
  }

  async findById(id: string): Promise<Order | null> {
    const row = await this.repository.findOne({ where: { id } });
    return row ? OrderMapper.toDomain(row) : null;
  }

  findByCustomer(
    customerId: string,
    filter: OrderFilter,
    page: PageRequest,
  ): Promise<Paged<Order>> {
    return this.findPaged({ customerId, ...toWhere(filter) }, page);
  }

  async findByDriver(
    driverId: string,
    filter: OrderFilter & { period?: Period },
    page: PageRequest,
  ): Promise<Paged<Order>> {
    const query = this.byDriver(driverId, filter.period);
    if (filter.status) {
      query.andWhere('o.status = :status', { status: filter.status });
    }
    if (filter.serviceType) {
      query.andWhere('o.service_type = :serviceType', {
        serviceType: filter.serviceType,
      });
    }
    const [rows, total] = await query
      .orderBy(DRIVER_ACTIVITY_AT, 'DESC')
      .offset(page.offset)
      .limit(page.limit)
      .getManyAndCount();
    return { items: rows.map((row) => OrderMapper.toDomain(row)), total };
  }

  async findFinishedByDriver(
    driverId: string,
    period: Period,
  ): Promise<Order[]> {
    const rows = await this.byDriver(driverId, period)
      .andWhere('o.status IN (:...statuses)', {
        statuses: FINISHED_FOR_DRIVER,
      })
      .orderBy(DRIVER_ACTIVITY_AT, 'ASC')
      .getMany();
    return rows.map((row) => OrderMapper.toDomain(row));
  }

  async findSettlementEntries(
    period: Period,
    driverId?: string,
  ): Promise<SettlementEntry[]> {
    const query = this.repository
      .createQueryBuilder('o')
      .select('o.driver_id', 'driverId')
      .addSelect('o.status', 'status')
      .addSelect('o.fare_amount + o.extra_fee + o.waiting_fee', 'totalFare')
      .addSelect('o.extra_fee + o.waiting_fee', 'extraFare')
      .addSelect('o.cancellation_fee', 'cancellationFee')
      .addSelect(
        'COALESCE(o.delivered_at, o.cancelled_at, o.no_show_at)',
        'finishedAt',
      )
      .where('o.driver_id IS NOT NULL')
      .andWhere(
        `((o.status = :delivered AND o.delivered_at >= :from AND o.delivered_at < :to)
         OR (o.status = :cancelled AND o.cancellation_fee > 0 AND o.cancelled_at >= :from AND o.cancelled_at < :to)
         OR (o.status = :noShow AND o.no_show_at >= :from AND o.no_show_at < :to))`,
        {
          delivered: OrderStatus.DELIVERED,
          cancelled: OrderStatus.CANCELLED,
          noShow: OrderStatus.NO_SHOW,
          from: period.from,
          to: period.to,
        },
      );
    if (driverId) {
      query.andWhere('o.driver_id = :driverId', { driverId });
    }
    const rows = await query.getRawMany<{
      driverId: string;
      status: OrderStatus;
      totalFare: string | number;
      extraFare: string | number;
      cancellationFee: string | number;
      finishedAt: Date;
    }>();
    return rows.map((row) => ({
      driverId: row.driverId,
      status: row.status,
      totalFare: Number(row.totalFare),
      extraFare: Number(row.extraFare),
      cancellationFee: Number(row.cancellationFee),
      finishedAt: new Date(row.finishedAt),
    }));
  }

  findOpen(vehicleType: VehicleType, page: PageRequest): Promise<Paged<Order>> {
    // 결제 중·결제 실패인 주문은 대기 목록에 보이지 않는다.
    return this.findPaged({ status: OrderStatus.REQUESTED, vehicleType }, page);
  }

  async findOpenNear(
    vehicleType: VehicleType,
    near: { latitude: number; longitude: number },
    radiusKm: number,
    page: PageRequest,
  ): Promise<Paged<Order>> {
    const box = boundingBox(near.latitude, near.longitude, radiusKm);
    const distance = distanceKmSql('o.pickup_latitude', 'o.pickup_longitude');
    const [rows, total] = await this.repository
      .createQueryBuilder('o')
      // 결제 중·결제 실패인 주문은 대기 목록에 보이지 않는다.
      .where('o.status = :status', { status: OrderStatus.REQUESTED })
      .andWhere('o.vehicle_type = :vehicleType', { vehicleType })
      .andWhere('o.pickup_latitude BETWEEN :minLat AND :maxLat', box)
      .andWhere('o.pickup_longitude BETWEEN :minLng AND :maxLng', box)
      .andWhere(`${distance} <= :radiusKm`, { radiusKm })
      .setParameters({ lat: near.latitude, lng: near.longitude })
      .orderBy(distance, 'ASC')
      .addOrderBy('o.requested_at', 'DESC')
      .offset(page.offset)
      .limit(page.limit)
      .getManyAndCount();
    return { items: rows.map((row) => OrderMapper.toDomain(row)), total };
  }

  async findRecentByCustomer(
    customerId: string,
    limit: number,
  ): Promise<Order[]> {
    const rows = await this.repository.find({
      where: { customerId },
      order: { requestedAt: 'DESC' },
      take: limit,
    });
    return rows.map((row) => OrderMapper.toDomain(row));
  }

  hasUnfinishedByCustomer(customerId: string): Promise<boolean> {
    return this.repository.existsBy({
      customerId,
      status: In([...UNFINISHED_STATUSES]),
    });
  }

  hasInProgressByDriver(driverId: string): Promise<boolean> {
    return this.repository.existsBy({
      driverId,
      status: In([...IN_PROGRESS_STATUSES]),
    });
  }

  private byDriver(
    driverId: string,
    period?: Period,
  ): SelectQueryBuilder<OrderOrmEntity> {
    const query = this.repository
      .createQueryBuilder('o')
      .where('o.driver_id = :driverId', { driverId });
    if (period) {
      query.andWhere(
        `${DRIVER_ACTIVITY_AT} >= :from AND ${DRIVER_ACTIVITY_AT} < :to`,
        period,
      );
    }
    return query;
  }

  private async findPaged(
    where: FindOptionsWhere<OrderOrmEntity>,
    page: PageRequest,
  ): Promise<Paged<Order>> {
    const [rows, total] = await this.repository.findAndCount({
      where,
      order: { requestedAt: 'DESC' },
      skip: page.offset,
      take: page.limit,
    });
    return { items: rows.map((row) => OrderMapper.toDomain(row)), total };
  }
}

function toWhere(filter: OrderFilter): FindOptionsWhere<OrderOrmEntity> {
  return {
    ...(filter.status ? { status: filter.status } : {}),
    ...(filter.serviceType ? { serviceType: filter.serviceType } : {}),
  };
}
