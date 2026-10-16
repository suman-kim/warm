import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Paged, PageRequest } from '../../../../common/domain/pagination.js';
import { persistAggregate } from '../../../../common/infrastructure/persistence/persist-aggregate.js';
import {
  FoodOrder,
  FoodOrderCanceller,
  FoodOrderStatus,
} from '../../domain/entities/food-order.entity.js';
import {
  FoodOrderFilter,
  FoodOrderRepository,
} from '../../domain/repositories/marketplace.repositories.js';
import { FoodOrderOrmEntity } from '../entities/food-order.orm-entity.js';

const UNFINISHED = [
  FoodOrderStatus.PLACED,
  FoodOrderStatus.ACCEPTED,
  FoodOrderStatus.PICKED_UP,
];

@Injectable()
export class FoodOrderTypeormRepository implements FoodOrderRepository {
  constructor(
    @InjectRepository(FoodOrderOrmEntity)
    private readonly orders: Repository<FoodOrderOrmEntity>,
  ) {}

  save(order: FoodOrder): Promise<void> {
    const state = order.snapshot();
    return persistAggregate(
      this.orders,
      order,
      Object.assign(new FoodOrderOrmEntity(), {
        id: state.id,
        consumerUserId: state.consumerUserId,
        storeId: state.storeId,
        storeOwnerUserId: state.storeOwnerUserId,
        storeName: state.storeName,
        lines: state.lines,
        menuAmount: state.menuAmount,
        deliveryTip: state.deliveryTip,
        paymentAmount: state.paymentAmount,
        dropoffAddress: state.dropoff.address,
        dropoffDetailAddress: state.dropoff.detailAddress,
        dropoffSigungu: state.dropoff.sigungu,
        dropoffDong: state.dropoff.dong,
        dropoffLatitude: state.dropoff.latitude,
        dropoffLongitude: state.dropoff.longitude,
        consumerPhone: state.consumerPhone,
        distanceKm: state.distanceKm,
        storeRequest: state.storeRequest,
        riderRequest: state.riderRequest,
        disposableCutlery: state.disposableCutlery,
        commissionRatePercent: state.commissionRatePercent,
        paymentFeeRatePercent: state.paymentFeeRatePercent,
        status: state.status,
        paymentId: state.paymentId,
        paidAt: state.paidAt,
        cookMinutes: state.cookMinutes,
        acceptedAt: state.acceptedAt,
        deliveryOrderId: state.deliveryOrderId,
        pickedUpAt: state.pickedUpAt,
        deliveredAt: state.deliveredAt,
        rejectedAt: state.rejectedAt,
        rejectReason: state.rejectReason,
        cancelledAt: state.cancelledAt,
        cancelReason: state.cancelReason,
        cancelledBy: state.cancelledBy,
        refunds: state.refunds,
        version: order.version,
        createdAt: state.createdAt,
      }),
    );
  }

  async findById(id: string): Promise<FoodOrder | null> {
    const row = await this.orders.findOne({ where: { id } });
    return row ? toFoodOrder(row) : null;
  }

  async findByPaymentId(paymentId: string): Promise<FoodOrder | null> {
    const row = await this.orders.findOne({ where: { paymentId } });
    return row ? toFoodOrder(row) : null;
  }

  async findByDeliveryOrderId(
    deliveryOrderId: string,
  ): Promise<FoodOrder | null> {
    const row = await this.orders.findOne({ where: { deliveryOrderId } });
    return row ? toFoodOrder(row) : null;
  }

  async find(
    filter: FoodOrderFilter,
    page: PageRequest,
  ): Promise<Paged<FoodOrder>> {
    const query = this.orders.createQueryBuilder('o');
    if (filter.storeId)
      query.andWhere('o.store_id = :storeId', { storeId: filter.storeId });
    if (filter.consumerUserId) {
      query.andWhere('o.consumer_user_id = :consumerUserId', {
        consumerUserId: filter.consumerUserId,
      });
    }
    if (filter.statuses) {
      if (filter.statuses.length === 0) return { items: [], total: 0 };
      query.andWhere('o.status IN (:...statuses)', {
        statuses: filter.statuses,
      });
    }
    if (filter.from)
      query.andWhere('o.created_at >= :from', { from: filter.from });
    if (filter.to) query.andWhere('o.created_at < :to', { to: filter.to });
    if (filter.placedBefore) {
      query.andWhere('o.paid_at < :placedBefore', {
        placedBefore: filter.placedBefore,
      });
    }
    if (filter.paidOnly) query.andWhere('o.paid_at IS NOT NULL');
    if (filter.refundFailed) {
      query.andWhere(`o.refunds @> '[{"status":"FAILED"}]'::jsonb`);
    }
    const [rows, total] = await query
      .orderBy('o.created_at', 'DESC')
      .addOrderBy('o.id', 'DESC')
      .offset(page.offset)
      .limit(page.limit)
      .getManyAndCount();
    return { items: rows.map(toFoodOrder), total };
  }

  countUnfinishedByConsumer(userId: string): Promise<number> {
    return this.orders.count({
      where: { consumerUserId: userId, status: In(UNFINISHED) },
    });
  }

  async deliveredCounts(
    storeIds: string[],
    since: Date,
  ): Promise<Map<string, number>> {
    if (storeIds.length === 0) return new Map();
    const rows = await this.orders
      .createQueryBuilder('o')
      .select('o.store_id', 'storeId')
      .addSelect('COUNT(*)', 'count')
      .where('o.store_id IN (:...storeIds)', { storeIds })
      .andWhere('o.status = :status', { status: FoodOrderStatus.DELIVERED })
      .andWhere('o.delivered_at >= :since', { since })
      .groupBy('o.store_id')
      .getRawMany<{ storeId: string; count: string }>();
    return new Map(rows.map((row) => [row.storeId, Number(row.count)]));
  }
}

function toFoodOrder(row: FoodOrderOrmEntity): FoodOrder {
  return FoodOrder.restore(
    {
      id: row.id,
      consumerUserId: row.consumerUserId,
      storeId: row.storeId,
      storeOwnerUserId: row.storeOwnerUserId,
      storeName: row.storeName,
      lines: row.lines,
      menuAmount: row.menuAmount,
      deliveryTip: row.deliveryTip,
      paymentAmount: row.paymentAmount,
      dropoff: {
        address: row.dropoffAddress,
        detailAddress: row.dropoffDetailAddress,
        sigungu: row.dropoffSigungu,
        dong: row.dropoffDong,
        latitude: row.dropoffLatitude,
        longitude: row.dropoffLongitude,
      },
      consumerPhone: row.consumerPhone,
      distanceKm: row.distanceKm,
      storeRequest: row.storeRequest,
      riderRequest: row.riderRequest,
      disposableCutlery: row.disposableCutlery,
      commissionRatePercent: row.commissionRatePercent,
      paymentFeeRatePercent: row.paymentFeeRatePercent,
      status: row.status as FoodOrderStatus,
      paymentId: row.paymentId,
      paidAt: row.paidAt,
      cookMinutes: row.cookMinutes,
      acceptedAt: row.acceptedAt,
      deliveryOrderId: row.deliveryOrderId,
      pickedUpAt: row.pickedUpAt,
      deliveredAt: row.deliveredAt,
      rejectedAt: row.rejectedAt,
      rejectReason: row.rejectReason,
      cancelledAt: row.cancelledAt,
      cancelReason: row.cancelReason,
      cancelledBy: row.cancelledBy as FoodOrderCanceller | null,
      // jsonb에는 시각이 문자열로 들어 있다.
      refunds: row.refunds.map((refund) => ({
        ...refund,
        refundedAt: new Date(refund.refundedAt),
        completedAt: refund.completedAt ? new Date(refund.completedAt) : null,
      })),
      createdAt: row.createdAt,
    },
    row.version,
  );
}
