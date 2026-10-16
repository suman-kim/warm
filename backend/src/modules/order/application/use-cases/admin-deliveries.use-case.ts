import { Inject, Injectable } from '@nestjs/common';
import { NotFoundError } from '../../../../common/domain/domain-error.js';
import { Order } from '../../domain/entities/order.entity.js';
import { OrderStatus } from '../../domain/order-status.js';
import {
  ORDER_REPOSITORY,
  type OrderRepository,
} from '../../domain/repositories/order.repository.js';
import {
  DISPATCH_LATE_MINUTES,
  PICKUP_LATE_MINUTES,
} from '../../domain/value-objects/store-delivery.js';
import {
  DeliveryFlag,
  DeliveryMonitorItemResult,
  DeliveryMonitorResult,
  RiderCashResult,
} from '../dto/admin-delivery.result.js';
import {
  ADMIN_DELIVERY_QUERY,
  type ActiveDeliveryRow,
  type AdminDeliveryQuery,
} from '../ports/admin-delivery.query.js';
import { toKstPeriod } from '../services/kst-period.js';

const MINUTE_MS = 60_000;

/**
 * 가게 배달 운영 (운영자).
 * 배달 관제: 진행 중인 배달을 단계별로 보고, 오래 배차되지 않았거나 픽업이 늦은 건을 위로 올린다.
 * 라이더 현금 수금: 라이더가 만나서 현금으로 받은 음식값을 가게에 넘겼는지 표시한다.
 */
@Injectable()
export class AdminDeliveriesUseCase {
  constructor(
    @Inject(ADMIN_DELIVERY_QUERY)
    private readonly query: AdminDeliveryQuery,
    @Inject(ORDER_REPOSITORY)
    private readonly orderRepository: OrderRepository,
  ) {}

  async monitor(
    flag: DeliveryFlag | null,
    now = new Date(),
  ): Promise<DeliveryMonitorResult> {
    const items = (await this.query.findActive()).map((row) =>
      toMonitorItem(row, now),
    );
    const count = (statuses: OrderStatus[]) =>
      items.filter((item) => statuses.includes(item.status)).length;
    const flagged = (f: DeliveryFlag) =>
      items.filter((item) => item.flag === f).length;
    // 지연된 것부터, 그다음 오래된 것부터.
    items.sort(
      (a, b) =>
        Number(b.flag !== null) - Number(a.flag !== null) ||
        b.elapsedMinutes - a.elapsedMinutes,
    );
    return {
      summary: {
        searching: count([OrderStatus.REQUESTED]),
        toStore: count([OrderStatus.ASSIGNED, OrderStatus.DEPARTED]),
        atStore: count([OrderStatus.ARRIVED]),
        delivering: count([OrderStatus.PICKED_UP]),
        dispatchLate: flagged(DeliveryFlag.DISPATCH_LATE),
        pickupLate: flagged(DeliveryFlag.PICKUP_LATE),
      },
      items: flag ? items.filter((item) => item.flag === flag) : items,
    };
  }

  /** 그날(한국 날짜) 전달한, 만나서 현금으로 받은 배달. [handed]로 넘김 여부를 거른다. */
  async cash(date: string, handed: boolean | null): Promise<RiderCashResult> {
    const rows = await this.query.findCash(toKstPeriod(date, date));
    const sum = (list: typeof rows) =>
      list.reduce((total, row) => total + row.collectedAmount, 0);
    const pending = rows.filter((row) => !row.cashHandedAt);
    return {
      summary: {
        date,
        total: sum(rows),
        handed: sum(rows) - sum(pending),
        pending: sum(pending),
        pendingCount: pending.length,
        count: rows.length,
      },
      items: rows
        .filter((row) => handed === null || !!row.cashHandedAt === handed)
        .map((row) => ({
          orderId: row.id,
          code: Order.codeOf(row.id, row.requestedAt),
          deliveredAt: row.deliveredAt,
          riderName: row.riderName,
          storeName: row.storeName,
          collectedAmount: row.collectedAmount,
          foodAmount: row.foodAmount,
          handedAt: row.cashHandedAt,
        })),
    };
  }

  /** 라이더가 받은 현금을 가게에 넘겼는지 표시한다. 돌려주는 값은 그 배달의 넘긴 시각. */
  async markHanded(
    orderId: string,
    handed: boolean,
  ): Promise<{ orderId: string; handedAt: Date | null }> {
    const order = await this.orderRepository.findById(orderId);
    if (!order) {
      throw new NotFoundError('ORDER_NOT_FOUND', '배달을 찾을 수 없어요.');
    }
    order.markCashHanded(handed, new Date());
    await this.orderRepository.save(order);
    return {
      orderId,
      handedAt: order.storeDelivery?.cashHandedAt ?? null,
    };
  }
}

function toMonitorItem(
  row: ActiveDeliveryRow,
  now: Date,
): DeliveryMonitorItemResult {
  const elapsedMinutes = Math.max(
    0,
    Math.floor((now.getTime() - row.requestedAt.getTime()) / MINUTE_MS),
  );
  const awaitingPickup = [
    OrderStatus.ASSIGNED,
    OrderStatus.DEPARTED,
    OrderStatus.ARRIVED,
  ].includes(row.status);
  const flag =
    row.status === OrderStatus.REQUESTED &&
    elapsedMinutes >= DISPATCH_LATE_MINUTES
      ? DeliveryFlag.DISPATCH_LATE
      : awaitingPickup && elapsedMinutes >= PICKUP_LATE_MINUTES
        ? DeliveryFlag.PICKUP_LATE
        : null;
  return {
    id: row.id,
    code: Order.codeOf(row.id, row.requestedAt),
    requestedAt: row.requestedAt,
    status: row.status,
    storeName: row.storeName,
    // 동이 없는 주소는 주소의 앞 두 마디(예: 서울 강남구)로 대신한다.
    customerArea:
      row.dropoffDong ?? row.dropoffAddress.split(' ').slice(0, 2).join(' '),
    elapsedMinutes,
    riderName: row.riderName,
    doorPayment: row.doorPayment,
    foodAmount: row.foodAmount,
    flag,
  };
}
