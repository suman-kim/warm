import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import {
  DOMAIN_EVENT_PUBLISHER,
  type DomainEventPublisher,
} from '../../../../common/application/domain-event-publisher.port.js';
import {
  ConflictError,
  NotFoundError,
} from '../../../../common/domain/domain-error.js';
import { Order } from '../../domain/entities/order.entity.js';
import { OrderStatus } from '../../domain/order-status.js';
import {
  ORDER_REPOSITORY,
  type OrderRepository,
} from '../../domain/repositories/order.repository.js';
import { GeoPoint } from '../../domain/value-objects/geo-point.js';
import { Money } from '../../domain/value-objects/money.js';
import {
  DeliveryFeePolicy,
  DeliverySource,
  DoorPayment,
} from '../../domain/value-objects/store-delivery.js';
import { Waypoint } from '../../domain/value-objects/waypoint.js';
import { TrackingResult } from '../dto/order.result.js';
import {
  DRIVER_DIRECTORY,
  type DriverDirectory,
} from '../ports/driver-directory.port.js';
import {
  ROUTE_PLANNER,
  type RoutePlanner,
} from '../ports/route-planner.port.js';
import { STORE_WALLET, type StoreWallet } from '../ports/store-wallet.port.js';
import { GetTrackingUseCase } from '../use-cases/get-tracking.use-case.js';

/** 주문앱 주문에서 배달을 요청할 때 넘기는 것. */
export interface LinkedDeliveryRequest {
  storeId: string;
  /** 주문앱 주문 ID */
  sourceOrderId: string;
  dropoff: {
    address: string;
    detailAddress: string | null;
    sigungu: string | null;
    dong: string | null;
    latitude: number;
    longitude: number;
    phone: string;
  };
  /** 손님이 이미 결제한 금액 (라이더는 받지 않는다) */
  foodAmount: number;
  /** 조리가 끝날 때까지 남은 분 */
  readyInMinutes: number;
  /** 라이더에게 남길 말 */
  memo: string | null;
}

/** 주문앱 주문에 딸린 배달의 지금 상태. */
export interface LinkedDeliveryView {
  deliveryId: string;
  status: OrderStatus;
  /** 배달대행료 (원) — 가게 정산에서 뺀다 */
  fare: number;
  /** 취소했으면 낸 수수료 (원) */
  cancellationFee: number;
  driverId: string | null;
  driverName: string | null;
  estimatedPickupAt: Date | null;
  estimatedDeliveryAt: Date | null;
  assignedAt: Date | null;
  pickedUpAt: Date | null;
  deliveredAt: Date | null;
}

/**
 * 다른 컨텍스트(주문앱)가 배달을 요청·취소·조회하는 입구.
 * 가게가 직접 요청하는 배달과 달리 대행료를 충전금에서 빼지 않는다 — 주문앱이 가게 정산에서 뺀다.
 * 권한 확인은 부르는 쪽(주문앱 주문의 주인 확인)이 한다.
 */
@Injectable()
export class LinkedDeliveryService {
  constructor(
    @Inject(STORE_WALLET)
    private readonly stores: StoreWallet,
    @Inject(ROUTE_PLANNER)
    private readonly routePlanner: RoutePlanner,
    @Inject(ORDER_REPOSITORY)
    private readonly orderRepository: OrderRepository,
    @Inject(DRIVER_DIRECTORY)
    private readonly driverDirectory: DriverDirectory,
    @Inject(DOMAIN_EVENT_PUBLISHER)
    private readonly eventPublisher: DomainEventPublisher,
    private readonly tracking: GetTrackingUseCase,
  ) {}

  /** 가게에서 손님까지의 도로 거리·시간과 지금 대행료. */
  async estimate(
    storeId: string,
    to: { latitude: number; longitude: number },
  ): Promise<{ distanceKm: number; durationMinutes: number; fee: number }> {
    const store = await this.requireStore(storeId);
    const route = await this.routePlanner.plan(
      GeoPoint.of(store.latitude, store.longitude),
      GeoPoint.of(to.latitude, to.longitude),
    );
    return {
      distanceKm: route.distanceKm,
      durationMinutes: route.durationMinutes,
      fee: DeliveryFeePolicy.feeFor(route.distanceKm, new Date()),
    };
  }

  /** 배달을 요청한다. 근처 라이더에게 콜이 간다. */
  async request(command: LinkedDeliveryRequest): Promise<LinkedDeliveryView> {
    const store = await this.requireStore(command.storeId);
    if (!store.approved) {
      throw new ConflictError(
        'STORE_NOT_APPROVED',
        '가게 승인이 끝나면 배달을 요청할 수 있어요.',
      );
    }
    const now = new Date();
    const pickup = Waypoint.of({
      address: store.address,
      detailAddress: store.detailAddress,
      sigungu: store.sigungu,
      dong: store.dong,
      latitude: store.latitude,
      longitude: store.longitude,
      contactName: store.name,
      contactPhone: store.phone,
    });
    const dropoff = Waypoint.of({
      ...command.dropoff,
      contactName: '손님',
      contactPhone: command.dropoff.phone,
    });
    const route = await this.routePlanner.plan(pickup.point, dropoff.point);
    const order = Order.request({
      id: randomUUID(),
      ownerUserId: store.ownerUserId,
      storeId: store.id,
      source: DeliverySource.FOOD_ORDER,
      sourceOrderId: command.sourceOrderId,
      pickup,
      dropoff,
      memo: command.memo,
      distanceKm: route.distanceKm,
      durationMinutes: route.durationMinutes,
      deliveryFee: Money.won(DeliveryFeePolicy.feeFor(route.distanceKm, now)),
      foodAmount: command.foodAmount,
      doorPayment: DoorPayment.PREPAID,
      readyAt:
        command.readyInMinutes > 0
          ? new Date(now.getTime() + command.readyInMinutes * 60_000)
          : null,
      now,
    });
    await this.orderRepository.save(order);
    await this.eventPublisher.publishAll(order.pullDomainEvents());
    return this.view(order);
  }

  /**
   * 배달을 취소한다. 라이더가 픽업한 뒤에는 할 수 없다 (ORDER_NOT_CANCELLABLE).
   * 라이더가 출발한 뒤면 취소 수수료가 붙는다 — 돌려받은 화면의 cancellationFee.
   */
  async cancel(
    deliveryId: string,
    reason: string,
  ): Promise<LinkedDeliveryView> {
    const order = await this.requireLinked(deliveryId);
    order.cancelByCustomer(order.customerId, reason, new Date());
    await this.orderRepository.save(order);
    await this.eventPublisher.publishAll(order.pullDomainEvents());
    return this.view(order);
  }

  async find(deliveryId: string): Promise<LinkedDeliveryView | null> {
    const order = await this.orderRepository.findById(deliveryId);
    return order ? this.view(order) : null;
  }

  /** 라이더 위치와 다시 어림한 예정 시각. */
  async track(deliveryId: string): Promise<TrackingResult> {
    return this.tracking.track(await this.requireLinked(deliveryId));
  }

  private async view(order: Order): Promise<LinkedDeliveryView> {
    const state = order.snapshot();
    const driver = state.driverId
      ? await this.driverDirectory.findById(state.driverId)
      : null;
    return {
      deliveryId: state.id,
      status: state.status,
      fare: state.fare.amount,
      cancellationFee: state.cancellationFee.amount,
      driverId: state.driverId,
      driverName: driver?.name ?? null,
      estimatedPickupAt: state.estimatedPickupAt,
      estimatedDeliveryAt: order.estimatedDeliveryAt,
      assignedAt: state.assignedAt,
      pickedUpAt: state.pickedUpAt,
      deliveredAt: state.deliveredAt,
    };
  }

  private async requireLinked(deliveryId: string): Promise<Order> {
    const order = await this.orderRepository.findById(deliveryId);
    if (!order || order.storeDelivery.source !== DeliverySource.FOOD_ORDER) {
      throw new NotFoundError('ORDER_NOT_FOUND', '배달을 찾을 수 없어요.');
    }
    return order;
  }

  private async requireStore(storeId: string) {
    const store = await this.stores.findById(storeId);
    if (!store) {
      throw new NotFoundError('STORE_NOT_FOUND', '가게를 찾을 수 없어요.');
    }
    return store;
  }
}
