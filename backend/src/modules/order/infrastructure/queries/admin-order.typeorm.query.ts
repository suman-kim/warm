import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { Paged, PageRequest } from '../../../../common/domain/pagination.js';
import { VehicleType } from '../../../../common/domain/vehicle-type.js';
import { OrderPaymentStatus } from '../../application/dto/order.result.js';
import {
  AdminOrderFilter,
  AdminOrderQuery,
  AdminOrderRow,
  AdminPaymentFilter,
} from '../../application/ports/admin-order.query.js';
import { OrderStatus } from '../../domain/order-status.js';
import { Period } from '../../domain/repositories/order.repository.js';
import { OrderOrmEntity } from '../entities/order.orm-entity.js';

/** 주문별 결제 합계 (결제 컨텍스트의 order_charges 테이블). */
const PAYMENTS = `(
  SELECT c.order_id,
    SUM(CASE WHEN c.status IN ('PAID', 'PARTIALLY_CANCELLED', 'CANCELLED') THEN c.amount ELSE 0 END) AS paid,
    SUM(c.cancelled_amount) AS refunded
  FROM order_charges c
  GROUP BY c.order_id
)`;
const PAID = 'COALESCE(pay.paid, 0)';
const REFUNDED = 'COALESCE(pay.refunded, 0)';

/** 결제 탭의 조건 */
const PAYMENT_CONDITIONS: Record<AdminPaymentFilter, string> = {
  [AdminPaymentFilter.UNPAID]: `${PAID} = 0 AND o.status <> '${OrderStatus.PAYMENT_FAILED}'`,
  [AdminPaymentFilter.FAILED]: `${PAID} = 0 AND o.status = '${OrderStatus.PAYMENT_FAILED}'`,
  [AdminPaymentFilter.PAID]: `${PAID} > 0 AND ${REFUNDED} = 0`,
  [AdminPaymentFilter.REFUND]: `${REFUNDED} > 0`,
};

interface RawRow {
  id: string;
  requested_at: Date;
  vehicle_type: string;
  pickup_address: string;
  pickup_dong: string | null;
  dropoff_address: string;
  dropoff_dong: string | null;
  distance_km: number;
  customer_name: string | null;
  driver_name: string | null;
  fare_amount: number;
  total_fare: string | number;
  status: string;
  paid: string | number;
  refunded: string | number;
}

/** 주문 현황 조회 TypeORM 구현체. */
@Injectable()
export class AdminOrderTypeormQuery implements AdminOrderQuery {
  constructor(
    @InjectRepository(OrderOrmEntity)
    private readonly repository: Repository<OrderOrmEntity>,
  ) {}

  async summarize(period: Period): Promise<{
    counts: Record<OrderStatus, number>;
    paymentCounts: Record<AdminPaymentFilter, number>;
    paidAmount: number;
    refundedAmount: number;
  }> {
    const query = this.within(period)
      .select('o.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .addSelect(`SUM(${PAID})`, 'paid')
      .addSelect(`SUM(${REFUNDED})`, 'refunded');
    for (const [filter, condition] of Object.entries(PAYMENT_CONDITIONS)) {
      query.addSelect(`COUNT(*) FILTER (WHERE ${condition})`, filter);
    }
    const rows = await query
      .groupBy('o.status')
      .getRawMany<Record<string, string>>();
    const counts = Object.fromEntries(
      Object.values(OrderStatus).map((status) => [status, 0]),
    ) as Record<OrderStatus, number>;
    const paymentCounts = Object.fromEntries(
      Object.values(AdminPaymentFilter).map((filter) => [filter, 0]),
    ) as Record<AdminPaymentFilter, number>;
    let paidAmount = 0;
    let refundedAmount = 0;
    for (const row of rows) {
      counts[row.status as OrderStatus] = Number(row.count);
      paidAmount += Number(row.paid ?? 0);
      refundedAmount += Number(row.refunded ?? 0);
      for (const filter of Object.values(AdminPaymentFilter)) {
        paymentCounts[filter] += Number(row[filter] ?? 0);
      }
    }
    return { counts, paymentCounts, paidAmount, refundedAmount };
  }

  async find(
    filter: AdminOrderFilter,
    page: PageRequest,
  ): Promise<Paged<AdminOrderRow>> {
    const query = this.within(filter.period);
    if (filter.statuses?.length) {
      query.andWhere('o.status IN (:...statuses)', {
        statuses: filter.statuses,
      });
    }
    if (filter.payment) {
      query.andWhere(PAYMENT_CONDITIONS[filter.payment]);
    }
    const total = await query.getCount();
    const rows = await query
      .leftJoin('users', 'customer', 'customer.id = o.customer_id')
      .leftJoin('drivers', 'driver', 'driver.id = o.driver_id')
      .leftJoin('users', 'driver_user', 'driver_user.id = driver.user_id')
      .select([
        'o.id AS id',
        'o.requested_at AS requested_at',
        'o.vehicle_type AS vehicle_type',
        'o.pickup_address AS pickup_address',
        'o.pickup_dong AS pickup_dong',
        'o.dropoff_address AS dropoff_address',
        'o.dropoff_dong AS dropoff_dong',
        'o.distance_km AS distance_km',
        'customer.name AS customer_name',
        'driver_user.name AS driver_name',
        'o.fare_amount AS fare_amount',
        'o.fare_amount + o.extra_fee + o.waiting_fee AS total_fare',
        'o.status AS status',
        `${PAID} AS paid`,
        `${REFUNDED} AS refunded`,
      ])
      .orderBy('o.requested_at', 'DESC')
      .addOrderBy('o.id', 'ASC')
      .offset(page.offset)
      .limit(page.limit)
      .getRawMany<RawRow>();
    return {
      items: rows.map((row) => {
        const paidAmount = Number(row.paid);
        const refundedAmount = Number(row.refunded);
        return {
          id: row.id,
          requestedAt: row.requested_at,
          vehicleType: row.vehicle_type as VehicleType,
          pickupAddress: row.pickup_address,
          pickupDong: row.pickup_dong,
          dropoffAddress: row.dropoff_address,
          dropoffDong: row.dropoff_dong,
          distanceKm: Number(row.distance_km),
          customerName: row.customer_name,
          driverName: row.driver_name,
          fare: Number(row.fare_amount),
          totalFare: Number(row.total_fare),
          status: row.status as OrderStatus,
          paymentStatus: paymentStatusOf(
            row.status as OrderStatus,
            paidAmount,
            refundedAmount,
          ),
          paidAmount,
          refundedAmount,
        };
      }),
      total,
    };
  }

  /** 요청 시각이 [period]에 드는 주문과 그 결제 합계. */
  private within(period: Period): SelectQueryBuilder<OrderOrmEntity> {
    return this.repository
      .createQueryBuilder('o')
      .leftJoin(PAYMENTS, 'pay', 'pay.order_id = o.id')
      .where('o.requested_at >= :from AND o.requested_at < :to', {
        from: period.from,
        to: period.to,
      });
  }
}

function paymentStatusOf(
  status: OrderStatus,
  paid: number,
  refunded: number,
): OrderPaymentStatus {
  if (paid === 0) {
    return status === OrderStatus.PAYMENT_FAILED
      ? OrderPaymentStatus.FAILED
      : OrderPaymentStatus.UNPAID;
  }
  if (refunded === 0) {
    return OrderPaymentStatus.PAID;
  }
  return refunded >= paid
    ? OrderPaymentStatus.REFUNDED
    : OrderPaymentStatus.PARTIALLY_REFUNDED;
}
