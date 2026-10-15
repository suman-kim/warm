import { Inject, Injectable } from '@nestjs/common';
import {
  DOMAIN_EVENT_PUBLISHER,
  type DomainEventPublisher,
} from '../../../../common/application/domain-event-publisher.port.js';
import {
  ConflictError,
  NotFoundError,
} from '../../../../common/domain/domain-error.js';
import { ChargeKind } from '../../../payment/domain/entities/order-charge.entity.js';
import { PaymentFailureCode } from '../../../payment/domain/payment-failure.js';
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
  ORDER_PAYMENTS,
  type ChargeAttempt,
  type OrderPayments,
} from '../ports/order-payments.port.js';
import {
  ROUTE_PLANNER,
  type RoutePlanner,
} from '../ports/route-planner.port.js';
import { DriverOrderTransition } from '../services/driver-order-transition.js';

const MINUTE_MS = 60_000;

/**
 * 주문 수락(배차) 유스케이스 (기사).
 * 먼저 수락한 기사 한 명이 주문을 잡고(동시에 수락하면 나머지는 409), 그 자리에서 고객의 카드로 요금을 결제한다.
 * 결제되면 배차가 끝나고, 안 되면 배차하지 않는다 — 주문은 결제 실패가 되어 대기 목록에서 내려가고
 * 기사는 PAYMENT_DECLINED(409)를 받는다. 고객은 다른 카드로 다시 요청할 수 있다.
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
    @Inject(ORDER_PAYMENTS)
    private readonly payments: OrderPayments,
    @Inject(DOMAIN_EVENT_PUBLISHER)
    private readonly eventPublisher: DomainEventPublisher,
    @Inject(SETTLEMENT_POLICY)
    private readonly policy: SettlementPolicy,
  ) {}

  async execute(userId: string, orderId: string): Promise<DriverOrderResult> {
    const driver = await this.transition.requireDispatchableDriver(userId);
    const order = await this.orderRepository.findById(orderId);
    if (!order) {
      throw new NotFoundError('ORDER_NOT_FOUND', '주문을 찾을 수 없어요.');
    }
    // 결제하는 동안 다른 기사가 수락하지 못하게 먼저 잡아 둔다 (낙관적 잠금으로 한 명만 성공한다).
    order.reserveForPayment(driver);
    await this.orderRepository.save(order);

    const minutesToPickup = await this.minutesToPickup(order, driver);
    const attempt = await this.payments
      .charge({
        orderId: order.id,
        customerId: order.customerId,
        paymentMethodId: order.paymentMethodId,
        kind: ChargeKind.DISPATCH,
        amount: order.fare,
        orderName: order.chargeName,
        routeLabel: order.routeLabel,
      })
      .catch(async (error: unknown): Promise<ChargeAttempt> => {
        // 결제 기록을 남기지 못했어도 주문이 결제 중에 멈춰 있지 않게 한다.
        await this.settle(order, {
          ok: false,
          failureCode: PaymentFailureCode.UNKNOWN,
          charge: null,
        });
        throw error;
      });
    await this.settle(order, attempt, minutesToPickup);
    if (!attempt.ok) {
      throw new ConflictError(
        'PAYMENT_DECLINED',
        '고객의 카드 결제가 안 돼 배차되지 않았어요.',
      );
    }
    return toDriverOrderResult(order, this.policy);
  }

  /** 결제 결과대로 배차를 마치거나 결제 실패로 돌린다. */
  private async settle(
    order: Order,
    attempt: ChargeAttempt,
    minutesToPickup: number | null = null,
  ): Promise<void> {
    const now = new Date();
    if (attempt.ok) {
      order.confirmAssignment(
        now,
        minutesToPickup === null
          ? null
          : new Date(now.getTime() + minutesToPickup * MINUTE_MS),
      );
    } else {
      order.failPayment(attempt.failureCode, now);
    }
    await this.orderRepository.save(order);
    await this.eventPublisher.publishAll(order.pullDomainEvents());
  }

  /** 기사의 위치를 알면 픽업지까지 걸리는 시간(분)을 어림한다. 모르면 null. */
  private async minutesToPickup(
    order: Order,
    driver: DispatchDriver,
  ): Promise<number | null> {
    const location = await this.driverDirectory.findLocation(driver.id);
    if (!location) {
      return null;
    }
    const toPickup = await this.routePlanner.plan(
      location.point,
      order.snapshot().pickup.point,
    );
    return toPickup.durationMinutes;
  }
}
