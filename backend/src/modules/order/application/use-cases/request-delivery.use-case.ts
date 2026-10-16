import { randomUUID } from 'node:crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  DOMAIN_EVENT_PUBLISHER,
  type DomainEventPublisher,
} from '../../../../common/application/domain-event-publisher.port.js';
import {
  ConflictError,
  NotFoundError,
} from '../../../../common/domain/domain-error.js';
import { Order } from '../../domain/entities/order.entity.js';
import {
  ORDER_REPOSITORY,
  type OrderRepository,
} from '../../domain/repositories/order.repository.js';
import { GeoPoint } from '../../domain/value-objects/geo-point.js';
import { Money } from '../../domain/value-objects/money.js';
import {
  DeliveryFeePolicy,
  DoorPayment,
} from '../../domain/value-objects/store-delivery.js';
import { Waypoint } from '../../domain/value-objects/waypoint.js';
import { OrderResult, toOrderResult } from '../dto/order.result.js';
import {
  ROUTE_PLANNER,
  type RoutePlanner,
} from '../ports/route-planner.port.js';
import {
  type DeliveryStore,
  STORE_WALLET,
  type StoreWallet,
  walletMemo,
} from '../ports/store-wallet.port.js';

/** 손님 (도착지) */
export interface DeliveryDestination {
  address: string;
  detailAddress?: string | null;
  sigungu?: string | null;
  dong?: string | null;
  latitude: number;
  longitude: number;
  /** 손님 연락처 — 라이더가 도착해서 전화한다 */
  phone: string;
}

export interface RequestDeliveryCommand {
  dropoff: DeliveryDestination;
  /** 음식값 (원) */
  foodAmount: number;
  doorPayment: DoorPayment;
  /** 조리가 끝나 픽업할 수 있는 때까지 남은 분. 0이면 바로. */
  readyInMinutes: number;
  memo?: string | null;
}

/** 배달대행료 견적 */
export interface DeliveryQuote {
  distanceKm: number;
  durationMinutes: number;
  /** 배달대행료 (원) */
  fee: number;
  /** 지금 충전금 잔액 (원) */
  walletBalance: number;
}

/**
 * 가게의 배달 요청 유스케이스 (사장님).
 * 픽업지는 가게 주소다. 배달대행료는 요청할 때 충전금에서 빠지고, 라이더가 수락하면 바로 배차된다.
 */
@Injectable()
export class RequestDeliveryUseCase {
  private readonly logger = new Logger(RequestDeliveryUseCase.name);

  constructor(
    @Inject(STORE_WALLET)
    private readonly wallet: StoreWallet,
    @Inject(ROUTE_PLANNER)
    private readonly routePlanner: RoutePlanner,
    @Inject(ORDER_REPOSITORY)
    private readonly orderRepository: OrderRepository,
    @Inject(DOMAIN_EVENT_PUBLISHER)
    private readonly eventPublisher: DomainEventPublisher,
  ) {}

  /** 손님 주소까지의 거리와 대행료. */
  async quote(
    ownerUserId: string,
    dropoff: Omit<DeliveryDestination, 'phone'>,
  ): Promise<DeliveryQuote> {
    const store = await this.requireStore(ownerUserId);
    const route = await this.routePlanner.plan(
      pickupOf(store).point,
      GeoPoint.of(dropoff.latitude, dropoff.longitude),
    );
    return {
      distanceKm: route.distanceKm,
      durationMinutes: route.durationMinutes,
      fee: DeliveryFeePolicy.feeFor(route.distanceKm, new Date()),
      walletBalance: store.walletBalance,
    };
  }

  async execute(
    ownerUserId: string,
    command: RequestDeliveryCommand,
  ): Promise<OrderResult> {
    const store = await this.requireStore(ownerUserId);
    if (!store.approved) {
      throw new ConflictError(
        'STORE_NOT_APPROVED',
        '가게 승인이 끝나면 배달을 요청할 수 있어요.',
      );
    }
    const now = new Date();
    const pickup = pickupOf(store);
    const dropoff = Waypoint.of({
      ...command.dropoff,
      contactName: '손님',
      contactPhone: command.dropoff.phone,
    });
    const route = await this.routePlanner.plan(pickup.point, dropoff.point);
    const fee = DeliveryFeePolicy.feeFor(route.distanceKm, now);
    const readyAt =
      command.readyInMinutes > 0
        ? new Date(now.getTime() + command.readyInMinutes * 60_000)
        : null;
    // 주문을 먼저 만들어 입력을 확인한 뒤 대행료를 뺀다 — 저장이 안 되면 돌려준다.
    const order = Order.request({
      id: randomUUID(),
      ownerUserId,
      storeId: store.id,
      pickup,
      dropoff,
      memo: command.memo,
      distanceKm: route.distanceKm,
      durationMinutes: route.durationMinutes,
      deliveryFee: Money.won(fee),
      foodAmount: command.foodAmount,
      doorPayment: command.doorPayment,
      readyAt,
      now,
    });
    await this.wallet.chargeDeliveryFee(
      store.id,
      order.id,
      fee,
      walletMemo(order),
    );
    try {
      await this.orderRepository.save(order);
    } catch (error) {
      await this.wallet
        .refundDeliveryFee(
          store.id,
          order.id,
          fee,
          walletMemo(order, '배달 요청 저장 실패'),
        )
        .catch((refundError: unknown) =>
          this.logger.error(
            `대행료를 돌려주지 못했어요 (${order.id}, ${fee}원)`,
            refundError,
          ),
        );
      throw error;
    }
    await this.eventPublisher.publishAll(order.pullDomainEvents());
    return toOrderResult(order);
  }

  private async requireStore(ownerUserId: string): Promise<DeliveryStore> {
    const store = await this.wallet.findByOwner(ownerUserId);
    if (!store) {
      throw new NotFoundError(
        'STORE_NOT_REGISTERED',
        '가게를 먼저 등록해 주세요.',
      );
    }
    return store;
  }
}

/** 가게 주소가 픽업지다. 현장 연락처는 가게 이름과 전화. */
function pickupOf(store: DeliveryStore): Waypoint {
  return Waypoint.of({
    address: store.address,
    detailAddress: store.detailAddress,
    sigungu: store.sigungu,
    dong: store.dong,
    latitude: store.latitude,
    longitude: store.longitude,
    contactName: store.name,
    contactPhone: store.phone,
  });
}
