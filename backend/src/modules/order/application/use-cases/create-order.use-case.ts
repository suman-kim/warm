import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import {
  DOMAIN_EVENT_PUBLISHER,
  type DomainEventPublisher,
} from '../../../../common/application/domain-event-publisher.port.js';
import { ConflictError } from '../../../../common/domain/domain-error.js';
import { VehicleType } from '../../../../common/domain/vehicle-type.js';
import { Order } from '../../domain/entities/order.entity.js';
import {
  ORDER_REPOSITORY,
  type OrderRepository,
} from '../../domain/repositories/order.repository.js';
import {
  FloorAccess,
  LoadingHelp,
} from '../../domain/services/charge-policy.js';
import { FarePolicy } from '../../domain/services/fare-policy.js';
import { Cargo, CargoInput } from '../../domain/value-objects/cargo.js';
import {
  Waypoint,
  WaypointInput,
} from '../../domain/value-objects/waypoint.js';
import { OrderResult, toOrderResult } from '../dto/order.result.js';
import {
  ORDER_PAYMENTS,
  type OrderPayments,
} from '../ports/order-payments.port.js';
import {
  ROUTE_PLANNER,
  type RoutePlanner,
} from '../ports/route-planner.port.js';

export interface CreateOrderCommand {
  vehicleType: VehicleType;
  pickup: WaypointInput;
  dropoff: WaypointInput;
  cargo: CargoInput;
  memo?: string | null;
  scheduledPickupAt?: Date | null;
  loadingHelp?: LoadingHelp;
  pickupAccess?: FloorAccess;
  dropoffAccess?: FloorAccess;
  /** 결제할 카드. 없으면 기본 카드. */
  paymentMethodId?: string | null;
}

/**
 * 배송 요청 유스케이스. 경로로 기본 요금을 정하고 운반 도움·계단 요금을 더해 배차 대기 주문을 만든다.
 * 등록한 카드가 있어야 요청할 수 있다 — 결제는 기사가 수락할 때 그 카드로 한다.
 */
@Injectable()
export class CreateOrderUseCase {
  constructor(
    @Inject(ORDER_REPOSITORY)
    private readonly orderRepository: OrderRepository,
    @Inject(ROUTE_PLANNER)
    private readonly routePlanner: RoutePlanner,
    @Inject(ORDER_PAYMENTS)
    private readonly payments: OrderPayments,
    @Inject(DOMAIN_EVENT_PUBLISHER)
    private readonly eventPublisher: DomainEventPublisher,
  ) {}

  async execute(
    customerId: string,
    command: CreateOrderCommand,
  ): Promise<OrderResult> {
    const pickup = Waypoint.of(command.pickup);
    const dropoff = Waypoint.of(command.dropoff);
    const [route, card] = await Promise.all([
      this.routePlanner.plan(pickup.point, dropoff.point),
      this.payments.cardFor(customerId, command.paymentMethodId),
    ]);
    const order = Order.request({
      id: randomUUID(),
      customerId,
      vehicleType: command.vehicleType,
      pickup,
      dropoff,
      cargo: Cargo.of(command.cargo),
      memo: command.memo,
      distanceKm: route.distanceKm,
      durationMinutes: route.durationMinutes,
      baseFare: FarePolicy.quote(command.vehicleType, route.distanceKm),
      loadingHelp: command.loadingHelp,
      pickupAccess: command.pickupAccess,
      dropoffAccess: command.dropoffAccess,
      paymentMethodId: card?.paymentMethodId ?? null,
      scheduledPickupAt: command.scheduledPickupAt,
      now: new Date(),
    });
    // 요청 내용이 맞는지 먼저 본 뒤에 카드를 따진다.
    if (
      !card ||
      (command.paymentMethodId &&
        card.paymentMethodId !== command.paymentMethodId)
    ) {
      throw new ConflictError(
        'PAYMENT_METHOD_REQUIRED',
        command.paymentMethodId
          ? '고른 카드를 쓸 수 없어요. 카드를 다시 골라 주세요.'
          : '결제할 카드를 먼저 등록해 주세요.',
      );
    }
    await this.orderRepository.save(order);
    await this.eventPublisher.publishAll(order.pullDomainEvents());
    return toOrderResult(order);
  }
}
