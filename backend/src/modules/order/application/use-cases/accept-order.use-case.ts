import { Inject, Injectable } from '@nestjs/common';
import {
  DOMAIN_EVENT_PUBLISHER,
  type DomainEventPublisher,
} from '../../../../common/application/domain-event-publisher.port.js';
import { MAX_ACTIVE_DELIVERIES } from '../../../../common/domain/dispatch-area.js';
import {
  ConflictError,
  NotFoundError,
} from '../../../../common/domain/domain-error.js';
import { Order } from '../../domain/entities/order.entity.js';
import {
  ORDER_REPOSITORY,
  type OrderRepository,
} from '../../domain/repositories/order.repository.js';
import {
  SETTLEMENT_POLICY,
  type SettlementPolicy,
} from '../../domain/services/settlement-policy.js';
import { DriverOrderResult, toDriverOrderResult } from '../dto/order.result.js';
import {
  DRIVER_DIRECTORY,
  type DispatchDriver,
  type DriverDirectory,
} from '../ports/driver-directory.port.js';
import {
  ROUTE_PLANNER,
  type RoutePlanner,
} from '../ports/route-planner.port.js';
import { DriverOrderTransition } from '../services/driver-order-transition.js';

const MINUTE_MS = 60_000;

/**
 * 배달 수락(배차) 유스케이스 (라이더).
 * 먼저 수락한 라이더 한 명이 배달을 잡는다 — 동시에 수락하면 낙관적 잠금으로 나머지는 409.
 * 대행료는 가게 충전금에서 이미 냈으니 결제 없이 바로 배차한다. 묶음배송 한도(3건)를 넘으면 받지 않는다.
 */
@Injectable()
export class AcceptOrderUseCase {
  constructor(
    private readonly transition: DriverOrderTransition,
    @Inject(ORDER_REPOSITORY)
    private readonly orderRepository: OrderRepository,
    @Inject(DRIVER_DIRECTORY)
    private readonly driverDirectory: DriverDirectory,
    @Inject(ROUTE_PLANNER)
    private readonly routePlanner: RoutePlanner,
    @Inject(DOMAIN_EVENT_PUBLISHER)
    private readonly eventPublisher: DomainEventPublisher,
    @Inject(SETTLEMENT_POLICY)
    private readonly policy: SettlementPolicy,
  ) {}

  async execute(userId: string, orderId: string): Promise<DriverOrderResult> {
    const driver = await this.transition.requireDispatchableDriver(userId);
    const order = await this.orderRepository.findById(orderId);
    if (!order) {
      throw new NotFoundError('ORDER_NOT_FOUND', '배달을 찾을 수 없어요.');
    }
    // 묶음배송 한도 — 진행 중인 배달이 한도만큼 있으면 더 받지 않는다.
    const active = await this.orderRepository.countInProgressByDriver(
      driver.id,
    );
    if (active >= MAX_ACTIVE_DELIVERIES) {
      throw new ConflictError(
        'TOO_MANY_ACTIVE_DELIVERIES',
        `동시에 ${MAX_ACTIVE_DELIVERIES}건까지 맡을 수 있어요. 진행 중인 배달을 먼저 끝내 주세요.`,
      );
    }
    const now = new Date();
    order.assign(driver.id, now, await this.pickupEta(order, driver, now));
    await this.orderRepository.save(order);
    await this.eventPublisher.publishAll(order.pullDomainEvents());
    return toDriverOrderResult(order, this.policy);
  }

  /**
   * 픽업 예정 시각: 라이더가 가게에 닿는 시각과 조리가 끝나는 시각 중 늦은 쪽.
   * 라이더 위치를 모르면 조리 완료 시각(없으면 null).
   */
  private async pickupEta(
    order: Order,
    driver: DispatchDriver,
    now: Date,
  ): Promise<Date | null> {
    const readyAt = order.storeDelivery.readyAt;
    const location = await this.driverDirectory.findLocation(driver.id);
    if (!location) return readyAt;
    const toStore = await this.routePlanner.plan(
      location.point,
      order.snapshot().pickup.point,
    );
    const arrival = new Date(
      now.getTime() + toStore.durationMinutes * MINUTE_MS,
    );
    return readyAt && readyAt > arrival ? readyAt : arrival;
  }
}
