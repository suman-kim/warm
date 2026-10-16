import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import {
  ActiveDeliveryRow,
  AdminDeliveryQuery,
  RiderCashRow,
} from '../../application/ports/admin-delivery.query.js';
import { OrderStatus } from '../../domain/order-status.js';
import { Period } from '../../domain/repositories/order.repository.js';
import { DoorPayment } from '../../domain/value-objects/store-delivery.js';
import { OrderOrmEntity } from '../entities/order.orm-entity.js';

/** 진행 중인 상태 (요청 ~ 배달 중) */
const ACTIVE = [
  OrderStatus.REQUESTED,
  OrderStatus.ASSIGNED,
  OrderStatus.DEPARTED,
  OrderStatus.ARRIVED,
  OrderStatus.PICKED_UP,
];

interface ActiveRaw {
  id: string;
  requested_at: Date;
  status: string;
  store_name: string;
  dropoff_dong: string | null;
  dropoff_address: string;
  rider_name: string | null;
  door_payment: string;
  food_amount: number | null;
}

interface CashRaw {
  id: string;
  requested_at: Date;
  delivered_at: Date;
  rider_name: string | null;
  store_name: string;
  collected_amount: number;
  food_amount: number | null;
  cash_handed_at: Date | null;
}

/** 배달 관제·라이더 현금 수금 조회 TypeORM 구현체. 가게 배달(store_id가 있는 주문)만 본다. */
@Injectable()
export class AdminDeliveryTypeormQuery implements AdminDeliveryQuery {
  constructor(
    @InjectRepository(OrderOrmEntity)
    private readonly repository: Repository<OrderOrmEntity>,
  ) {}

  async findActive(): Promise<ActiveDeliveryRow[]> {
    const rows = await this.storeDeliveries()
      .andWhere('o.status IN (:...active)', { active: ACTIVE })
      .select([
        'o.id AS id',
        'o.requested_at AS requested_at',
        'o.status AS status',
        // 가게 배달의 픽업지 연락처 이름이 가게 이름이다.
        'o.pickup_contact_name AS store_name',
        'o.dropoff_dong AS dropoff_dong',
        'o.dropoff_address AS dropoff_address',
        'rider_user.name AS rider_name',
        'o.door_payment AS door_payment',
        'o.food_amount AS food_amount',
      ])
      .orderBy('o.requested_at', 'ASC')
      .getRawMany<ActiveRaw>();
    return rows.map((row) => ({
      id: row.id,
      requestedAt: row.requested_at,
      status: row.status as OrderStatus,
      storeName: row.store_name,
      dropoffDong: row.dropoff_dong,
      dropoffAddress: row.dropoff_address,
      riderName: row.rider_name,
      doorPayment: row.door_payment as DoorPayment,
      foodAmount: Number(row.food_amount ?? 0),
    }));
  }

  async findCash(period: Period): Promise<RiderCashRow[]> {
    const rows = await this.storeDeliveries()
      .andWhere('o.status = :delivered', { delivered: OrderStatus.DELIVERED })
      .andWhere('o.collected_method = :cash', { cash: DoorPayment.CASH })
      .andWhere('o.delivered_at >= :from AND o.delivered_at < :to', {
        from: period.from,
        to: period.to,
      })
      .select([
        'o.id AS id',
        'o.requested_at AS requested_at',
        'o.delivered_at AS delivered_at',
        'rider_user.name AS rider_name',
        'o.pickup_contact_name AS store_name',
        'o.collected_amount AS collected_amount',
        'o.food_amount AS food_amount',
        'o.cash_handed_at AS cash_handed_at',
      ])
      .orderBy('o.delivered_at', 'DESC')
      .getRawMany<CashRaw>();
    return rows.map((row) => ({
      id: row.id,
      requestedAt: row.requested_at,
      deliveredAt: row.delivered_at,
      riderName: row.rider_name,
      storeName: row.store_name,
      collectedAmount: Number(row.collected_amount),
      foodAmount: Number(row.food_amount ?? 0),
      cashHandedAt: row.cash_handed_at,
    }));
  }

  /** 가게 배달과 맡은 라이더의 이름. */
  private storeDeliveries(): SelectQueryBuilder<OrderOrmEntity> {
    return this.repository
      .createQueryBuilder('o')
      .leftJoin('drivers', 'rider', 'rider.id = o.driver_id')
      .leftJoin('users', 'rider_user', 'rider_user.id = rider.user_id')
      .where('o.store_id IS NOT NULL');
  }
}
