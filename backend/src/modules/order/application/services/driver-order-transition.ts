import { Inject, Injectable } from '@nestjs/common';
import {
  DOMAIN_EVENT_PUBLISHER,
  type DomainEventPublisher,
} from '../../../../common/application/domain-event-publisher.port.js';
import {
  ForbiddenError,
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

/**
 * 라이더가 배달 상태를 바꾸는 공통 흐름: 라이더 확인 → 배달 읽기 → 전이 → 저장 → 이벤트 발행.
 * 출발·도착·픽업·배달 완료 유스케이스가 전이만 다르게 넘겨 쓴다.
 */
@Injectable()
export class DriverOrderTransition {
  constructor(
    @Inject(ORDER_REPOSITORY)
    private readonly orderRepository: OrderRepository,
    @Inject(DRIVER_DIRECTORY)
    private readonly driverDirectory: DriverDirectory,
    @Inject(DOMAIN_EVENT_PUBLISHER)
    private readonly eventPublisher: DomainEventPublisher,
    @Inject(SETTLEMENT_POLICY)
    private readonly policy: SettlementPolicy,
  ) {}

  async run(
    userId: string,
    orderId: string,
    transition: (
      order: Order,
      driver: DispatchDriver,
      now: Date,
    ) => void | Promise<void>,
  ): Promise<DriverOrderResult> {
    const driver = await this.requireDriver(userId);
    const order = await this.orderRepository.findById(orderId);
    if (!order) {
      throw new NotFoundError('ORDER_NOT_FOUND', '배달을 찾을 수 없어요.');
    }
    await transition(order, driver, new Date());
    await this.orderRepository.save(order);
    await this.eventPublisher.publishAll(order.pullDomainEvents());
    return toDriverOrderResult(order, this.policy);
  }

  /** 회원의 라이더 정보를 읽는다. 라이더 등록을 하지 않았으면 ForbiddenError. */
  async requireDriver(userId: string): Promise<DispatchDriver> {
    const driver = await this.driverDirectory.findByUserId(userId);
    if (!driver) {
      throw new ForbiddenError(
        'DRIVER_NOT_REGISTERED',
        '라이더 등록을 먼저 해 주세요.',
      );
    }
    return driver;
  }

  /** 승인됐고 운행 중인 기사인지 확인한다. 배차 대기 주문을 보거나 수락할 때 쓴다. */
  async requireDispatchableDriver(userId: string): Promise<DispatchDriver> {
    const driver = await this.requireDriver(userId);
    assertCanAcceptOrders(driver);
    return driver;
  }
}

export function assertCanAcceptOrders(driver: DispatchDriver): void {
  if (!driver.canAcceptOrders) {
    throw new ForbiddenError(
      'DRIVER_NOT_AVAILABLE',
      '승인을 받고 운행을 시작한 뒤에 이용할 수 있어요.',
    );
  }
}
