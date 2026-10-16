import { randomUUID } from 'node:crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  DOMAIN_EVENT_PUBLISHER,
  type DomainEventPublisher,
} from '../../../../common/application/domain-event-publisher.port.js';
import {
  ConflictError,
  ForbiddenError,
  InvalidArgumentError,
  NotFoundError,
} from '../../../../common/domain/domain-error.js';
import { UserRole } from '../../../../common/domain/user-role.js';
import { MarketplacePolicyService } from '../../../platform-policy/application/marketplace-policy.service.js';
import { Store } from '../../../store/domain/store.entity.js';
import {
  STORE_REPOSITORY,
  type StoreRepository,
} from '../../../store/domain/store.repository.js';
import {
  USER_REPOSITORY,
  type UserRepository,
} from '../../../user/domain/repositories/user.repository.js';
import {
  FoodOrder,
  FoodOrderDestination,
  FoodOrderStatus,
} from '../../domain/entities/food-order.entity.js';
import { MenuItem } from '../../domain/entities/menu.entity.js';
import { Storefront } from '../../domain/entities/storefront.entity.js';
import {
  FOOD_ORDER_REPOSITORY,
  type FoodOrderRepository,
  MENU_REPOSITORY,
  type MenuRepository,
  STOREFRONT_REPOSITORY,
  type StorefrontRepository,
} from '../../domain/repositories/marketplace.repositories.js';
import {
  CartLineInput,
  priceCart,
  straightDistanceKm,
} from '../../domain/services/cart-pricing.js';
import {
  FoodOrderDetailResult,
  FoodOrderQuoteResult,
  PlacedFoodOrderResult,
} from '../dto/marketplace.result.js';
import {
  GatewayPaymentStatus,
  PAYMENT_GATEWAY,
  type PaymentGateway,
} from '../ports/payment-gateway.port.js';
import { FoodOrderViews } from '../services/food-order-views.js';

export interface CheckoutCommand {
  storeId: string;
  lines: CartLineInput[];
  dropoff: FoodOrderDestination;
}

export interface PlaceFoodOrderCommand extends CheckoutCommand {
  storeRequest?: string | null;
  riderRequest?: string | null;
  disposableCutlery?: boolean;
}

/**
 * 장바구니 → 주문 → 결제. 금액은 서버가 메뉴·배달팁 설정으로 다시 계산하고,
 * PG에 미리 등록한 금액과 실제 결제된 금액을 견줘서 맞을 때만 가게에 주문이 들어간다.
 * 결제 확인은 손님 앱(결제창이 닫힌 뒤)과 PG 웹훅 두 곳에서 오며, 먼저 온 쪽이 처리한다.
 */
@Injectable()
export class CheckoutUseCase {
  private readonly logger = new Logger(CheckoutUseCase.name);

  constructor(
    @Inject(STOREFRONT_REPOSITORY)
    private readonly storefronts: StorefrontRepository,
    @Inject(STORE_REPOSITORY)
    private readonly stores: StoreRepository,
    @Inject(MENU_REPOSITORY)
    private readonly menus: MenuRepository,
    @Inject(FOOD_ORDER_REPOSITORY)
    private readonly orders: FoodOrderRepository,
    @Inject(USER_REPOSITORY)
    private readonly users: UserRepository,
    @Inject(PAYMENT_GATEWAY)
    private readonly gateway: PaymentGateway,
    @Inject(DOMAIN_EVENT_PUBLISHER)
    private readonly eventPublisher: DomainEventPublisher,
    private readonly policy: MarketplacePolicyService,
    private readonly views: FoodOrderViews,
  ) {}

  /** 결제 전 금액 확인. 주문할 수 없으면 그 이유(blocker)를 준다. */
  async quote(command: CheckoutCommand): Promise<FoodOrderQuoteResult> {
    const { store, storefront, items } = await this.load(command.storeId);
    const { lines, menuAmount } = priceCart(items, command.lines);
    const distanceKm = straightDistanceKm(
      store.snapshot().address,
      command.dropoff,
    );
    const deliveryTip = storefront.deliveryTipFor(menuAmount, distanceKm);
    const closedReason = storefront.availability(new Date());
    const deliverable = distanceKm <= storefront.maxDeliveryKm;
    const shortOfMinOrder = Math.max(0, storefront.minOrderAmount - menuAmount);
    return {
      storeId: store.id,
      storeName: store.snapshot().name,
      lines,
      menuAmount,
      deliveryTip,
      paymentAmount: menuAmount + deliveryTip,
      distanceKm,
      minOrderAmount: storefront.minOrderAmount,
      shortOfMinOrder,
      deliverable,
      closedReason,
      blocker: closedReason
        ? 'CLOSED'
        : !deliverable
          ? 'TOO_FAR'
          : shortOfMinOrder > 0
            ? 'BELOW_MIN_ORDER'
            : null,
    };
  }

  /** 주문을 만들고 PG에 금액을 등록한다. 돌려준 값으로 손님 앱이 결제창을 연다. */
  async place(
    consumerUserId: string,
    command: PlaceFoodOrderCommand,
  ): Promise<PlacedFoodOrderResult> {
    const quote = await this.quote(command);
    if (quote.blocker === 'CLOSED') {
      throw new ConflictError(
        'STORE_CLOSED',
        '지금은 주문을 받지 않는 가게예요.',
      );
    }
    if (quote.blocker === 'TOO_FAR') {
      throw new ConflictError(
        'OUT_OF_DELIVERY_AREA',
        '배달하지 않는 주소예요.',
      );
    }
    if (quote.blocker === 'BELOW_MIN_ORDER') {
      throw new ConflictError(
        'BELOW_MIN_ORDER',
        `최소 주문 금액까지 ${quote.shortOfMinOrder.toLocaleString('ko-KR')}원 남았어요.`,
      );
    }
    const consumer = await this.users.findById(consumerUserId);
    if (!consumer || consumer.role !== UserRole.CONSUMER) {
      throw new ForbiddenError('NOT_CONSUMER', '손님 계정으로 주문해 주세요.');
    }
    const store = await this.stores.findById(command.storeId);
    if (!store) {
      throw new NotFoundError('STOREFRONT_NOT_FOUND', '가게를 찾을 수 없어요.');
    }
    const policy = await this.policy.current();
    const id = randomUUID();
    const order = FoodOrder.place({
      id,
      consumerUserId,
      storeId: store.id,
      storeOwnerUserId: store.ownerUserId,
      storeName: store.snapshot().name,
      lines: quote.lines,
      menuAmount: quote.menuAmount,
      deliveryTip: quote.deliveryTip,
      dropoff: {
        address: command.dropoff.address,
        detailAddress: command.dropoff.detailAddress ?? null,
        sigungu: command.dropoff.sigungu ?? null,
        dong: command.dropoff.dong ?? null,
        latitude: command.dropoff.latitude,
        longitude: command.dropoff.longitude,
      },
      consumerPhone: consumer.phone,
      distanceKm: quote.distanceKm,
      storeRequest: command.storeRequest ?? null,
      riderRequest: command.riderRequest ?? null,
      disposableCutlery: command.disposableCutlery ?? false,
      commissionRatePercent: policy.commissionRatePercent,
      paymentFeeRatePercent: policy.paymentFeeRatePercent,
      paymentId: `food-${id}`,
      createdAt: new Date(),
    });
    await this.orders.save(order);
    const checkout = await this.gateway.prepare({
      paymentId: order.paymentId,
      amount: order.snapshot().paymentAmount,
      orderName: `${order.snapshot().storeName} ${order.summary()}`.slice(
        0,
        60,
      ),
    });
    return { order: await this.views.detail(order, 'CONSUMER'), checkout };
  }

  /** 손님 앱이 결제창을 닫은 뒤 부른다. PG에 결제 상태를 물어 주문에 반영한다. */
  async completePayment(
    consumerUserId: string,
    orderId: string,
  ): Promise<FoodOrderDetailResult> {
    const order = await this.orders.findById(orderId);
    if (!order || !order.isOrderedBy(consumerUserId)) {
      throw new NotFoundError('FOOD_ORDER_NOT_FOUND', '주문을 찾을 수 없어요.');
    }
    const confirmed = await this.confirm(order);
    if (!confirmed.isPaid) {
      throw new ConflictError(
        'PAYMENT_NOT_COMPLETED',
        '결제가 끝나지 않았어요. 다시 시도해 주세요.',
      );
    }
    return this.views.detail(confirmed, 'CONSUMER');
  }

  /** PG 웹훅. 서명이 틀리면 거절하고, 결제와 상관없는 알림은 무시한다. */
  async handleWebhook(
    rawBody: string,
    headers: Record<string, string | string[] | undefined>,
  ): Promise<void> {
    const webhook = await this.gateway.verifyWebhook(rawBody, headers);
    if (!webhook) {
      throw new InvalidArgumentError(
        'INVALID_WEBHOOK',
        '웹훅 서명이 맞지 않아요.',
      );
    }
    if (!webhook.paymentId) return;
    const order = await this.orders.findByPaymentId(webhook.paymentId);
    if (!order) {
      this.logger.warn(
        `웹훅의 결제에 맞는 주문이 없어요 (${webhook.paymentId})`,
      );
      return;
    }
    await this.confirm(order);
  }

  /**
   * PG의 결제 상태를 주문에 반영한다. 이미 반영했으면 그대로 둔다.
   * 결제 전에 취소한 주문이 뒤늦게 결제됐거나 금액이 다르면 PG 결제를 바로 취소한다.
   */
  private async confirm(order: FoodOrder): Promise<FoodOrder> {
    if (order.isPaid) return order;
    const payment = await this.gateway.getPayment(order.paymentId);
    if (!payment || payment.status !== GatewayPaymentStatus.PAID) return order;
    const expected = order.snapshot().paymentAmount;
    if (
      order.status !== FoodOrderStatus.PENDING_PAYMENT ||
      payment.amount !== expected
    ) {
      const reason =
        order.status !== FoodOrderStatus.PENDING_PAYMENT
          ? '이미 취소된 주문의 결제'
          : '주문 금액과 다른 결제';
      this.logger.warn(`${reason} — PG 결제를 취소해요 (${order.id})`);
      await this.gateway.cancel({
        paymentId: order.paymentId,
        amount: payment.amount,
        reason,
        cancellableAmount: payment.amount,
      });
      if (order.status === FoodOrderStatus.PENDING_PAYMENT) {
        throw new ConflictError(
          'PAYMENT_AMOUNT_MISMATCH',
          '결제 금액이 주문 금액과 달라 결제를 취소했어요.',
        );
      }
      return order;
    }
    order.markPaid(payment.amount, new Date());
    try {
      await this.orders.save(order);
    } catch (error) {
      // 손님 앱과 웹훅이 동시에 반영하려 했으면 먼저 저장한 쪽의 결과를 읽어 준다.
      if (error instanceof ConflictError && error.code === 'STALE_AGGREGATE') {
        return (await this.orders.findById(order.id)) ?? order;
      }
      throw error;
    }
    await this.eventPublisher.publishAll(order.pullDomainEvents());
    return order;
  }

  private async load(storeId: string): Promise<{
    store: Store;
    storefront: Storefront;
    items: Map<string, MenuItem>;
  }> {
    const [store, storefront] = await Promise.all([
      this.stores.findById(storeId),
      this.storefronts.findByStoreId(storeId),
    ]);
    if (
      !store ||
      !store.isApproved ||
      !storefront ||
      storefront.snapshot().hiddenAt
    ) {
      throw new NotFoundError('STOREFRONT_NOT_FOUND', '가게를 찾을 수 없어요.');
    }
    const items = await this.menus.findItems(storeId);
    return {
      store,
      storefront,
      items: new Map(items.map((item) => [item.id, item])),
    };
  }
}
