import { Inject, Injectable } from '@nestjs/common';
import { DomainEvent } from '../../../../common/domain/domain-event.js';
import {
  DriverApprovedEvent,
  DriverRejectedEvent,
} from '../../../driver/domain/events/driver.events.js';
import { FoodOrderCanceller } from '../../../marketplace/domain/entities/food-order.entity.js';
import {
  FoodOrderAcceptedEvent,
  FoodOrderCancelledEvent,
  FoodOrderDeliveredEvent,
  FoodOrderPickedUpEvent,
  FoodOrderPlacedEvent,
  FoodOrderRejectedEvent,
} from '../../../marketplace/domain/events/food-order.events.js';
import {
  OrderArrivedEvent,
  OrderAssignedEvent,
  OrderCancelledEvent,
  OrderDeliveredEvent,
  OrderDepartedEvent,
  OrderPickedUpEvent,
  OrderRequestedEvent,
} from '../../../order/domain/events/order.events.js';
import { DeliveryFeePolicy } from '../../../order/domain/value-objects/store-delivery.js';
import {
  PushCategory,
  PushMessage,
  PushType,
} from '../../domain/push-message.js';
import {
  PUSH_AUDIENCE,
  type PushAudience,
} from '../ports/push-audience.port.js';
import { PushNotifier } from '../services/push-notifier.js';

interface Notice {
  userIds: string[];
  message: PushMessage;
  /** 알림함에도 남길지. 금방 낡는 알림(새 콜)은 남기지 않는다. */
  keepInInbox: boolean;
}

/**
 * 다른 컨텍스트에서 일어난 일을 알림으로 바꾸는 유스케이스. 누구에게 무엇을 보낼지 여기서 정한다.
 *
 * | 일어난 일                          | 받는 사람                               | 알림함 |
 * | ---------------------------------- | --------------------------------------- | ------ |
 * | 배달 요청                          | 가게 근처의 운행 중인 라이더 전원       | ✕      |
 * | 배차·출발·가게 도착·픽업·배달 완료 | 사장님                                  | ○      |
 * | 배달 취소                          | 배차돼 있던 라이더 (배차 전이면 없음)   | ○      |
 * | 라이더 승인·반려                   | 그 라이더                               | ○      |
 * | 주문앱 새 주문 (결제 완료)          | 사장님 (새 콜 채널 — 소리)               | ○      |
 * | 주문앱 접수·거절·픽업·배달 완료      | 손님                                    | ○      |
 * | 주문앱 취소                         | 손님 취소 → 사장님, 가게 취소 → 손님, 운영자 취소 → 둘 다 | ○ |
 */
@Injectable()
export class NotifyEventUseCase {
  constructor(
    @Inject(PUSH_AUDIENCE)
    private readonly audience: PushAudience,
    private readonly pushNotifier: PushNotifier,
  ) {}

  async execute(event: DomainEvent): Promise<void> {
    const notice = await this.toNotice(event);
    if (notice) {
      await this.pushNotifier.notifyUsers(notice.userIds, notice.message, {
        keepInInbox: notice.keepInInbox,
      });
    }
  }

  private async toNotice(event: DomainEvent): Promise<Notice | null> {
    if (event instanceof OrderRequestedEvent) {
      return {
        // 가게 근처에서 최근 위치를 보낸 라이더에게만 알린다.
        userIds: await this.audience.findAvailableDriverUserIds({
          ...event.pickupPoint,
          radiusKm: event.dispatchRadiusKm,
        }),
        message: {
          category: PushCategory.NEW_ORDER,
          title: '새 콜이 들어왔어요',
          // 콜 목록에 보이는 것과 같은 범위만 싣는다 (동 단위 위치와 대행료).
          body: `${event.pickupArea} → ${event.dropoffArea} · 대행료 ${won(event.fareAmount)}`,
          data: orderData(PushType.ORDER_REQUESTED, event),
        },
        keepInInbox: false,
      };
    }
    if (event instanceof OrderAssignedEvent) {
      return toCustomer(
        event,
        PushType.ORDER_ASSIGNED,
        '라이더가 배정됐어요',
        '라이더가 가게로 오고 있어요. 도착하면 알려 드릴게요.',
      );
    }
    if (event instanceof OrderDepartedEvent) {
      return toCustomer(
        event,
        PushType.ORDER_DEPARTED,
        '라이더가 가게로 출발했어요',
        `지금부터 취소하면 대행료의 ${DeliveryFeePolicy.CANCELLATION_FEE_PERCENT}%가 수수료로 빠져요.`,
      );
    }
    if (event instanceof OrderArrivedEvent) {
      return toCustomer(
        event,
        PushType.ORDER_ARRIVED,
        '라이더가 가게에 도착했어요',
        '주문번호 끝자리를 확인하고 음식을 전해 주세요.',
      );
    }
    if (event instanceof OrderPickedUpEvent) {
      return toCustomer(
        event,
        PushType.ORDER_PICKED_UP,
        '라이더가 음식을 픽업했어요',
        '손님에게 배달하고 있어요.',
      );
    }
    if (event instanceof OrderDeliveredEvent) {
      return toCustomer(
        event,
        PushType.ORDER_DELIVERED,
        '배달을 마쳤어요',
        '손님에게 음식을 전했어요.',
      );
    }
    if (event instanceof OrderCancelledEvent) {
      const driverUserId = event.driverId
        ? await this.audience.findDriverUserId(event.driverId)
        : null;
      return driverUserId
        ? {
            userIds: [driverUserId],
            message: statusMessage(
              event,
              PushType.ORDER_CANCELLED,
              '가게가 배달을 취소했어요',
              '진행 중 배달에서 뺐어요. 가게로 가지 않아도 돼요.',
            ),
            keepInInbox: true,
          }
        : null;
    }
    if (event instanceof FoodOrderPlacedEvent) {
      return {
        userIds: [event.storeOwnerUserId],
        message: {
          category: PushCategory.NEW_ORDER,
          title: '새 주문이 들어왔어요',
          body: `${event.summary} · ${won(event.paymentAmount)}`,
          data: foodOrderData(PushType.FOOD_ORDER_PLACED, event),
        },
        keepInInbox: true,
      };
    }
    if (event instanceof FoodOrderAcceptedEvent) {
      return toConsumer(
        event,
        PushType.FOOD_ORDER_ACCEPTED,
        `${event.storeName}에서 주문을 받았어요`,
        event.cookMinutes > 0
          ? `약 ${event.cookMinutes}분 조리한 뒤 라이더가 가져가요.`
          : '곧 라이더가 가져가요.',
      );
    }
    if (event instanceof FoodOrderRejectedEvent) {
      return toConsumer(
        event,
        PushType.FOOD_ORDER_REJECTED,
        `${event.storeName}에서 주문을 받지 못했어요`,
        `${event.reason} · 결제한 금액은 모두 돌려드려요.`,
      );
    }
    if (event instanceof FoodOrderPickedUpEvent) {
      return toConsumer(
        event,
        PushType.FOOD_ORDER_PICKED_UP,
        '라이더가 음식을 가지고 출발했어요',
        '지도에서 라이더 위치를 볼 수 있어요.',
      );
    }
    if (event instanceof FoodOrderDeliveredEvent) {
      return toConsumer(
        event,
        PushType.FOOD_ORDER_DELIVERED,
        '배달이 끝났어요',
        `맛있게 드세요. ${event.storeName}에 리뷰를 남겨 주세요.`,
      );
    }
    if (event instanceof FoodOrderCancelledEvent) {
      return foodOrderCancelled(event);
    }
    if (event instanceof DriverApprovedEvent) {
      return toDriverAccount(
        event.userId,
        PushType.DRIVER_APPROVED,
        '가입이 승인됐어요',
        '운행을 켜면 콜을 받을 수 있어요.',
      );
    }
    if (event instanceof DriverRejectedEvent) {
      return toDriverAccount(
        event.userId,
        PushType.DRIVER_REJECTED,
        '서류를 다시 확인해 주세요',
        event.reason,
      );
    }
    return null;
  }
}

function toCustomer(
  event: DomainEvent & { customerId: string },
  type: PushType,
  title: string,
  body: string,
): Notice {
  return {
    userIds: [event.customerId],
    message: statusMessage(event, type, title, body),
    keepInInbox: true,
  };
}

function toConsumer(
  event: DomainEvent & { consumerUserId: string },
  type: PushType,
  title: string,
  body: string,
): Notice {
  return {
    userIds: [event.consumerUserId],
    message: foodOrderMessage(event, type, title, body),
    keepInInbox: true,
  };
}

/** 취소한 쪽이 아닌 사람에게 알린다. 결제 전에 손님이 그만둔 주문은 가게가 모르므로 알리지 않는다. */
function foodOrderCancelled(event: FoodOrderCancelledEvent): Notice | null {
  const refund = event.wasPaid ? ' 결제한 금액은 모두 돌려드려요.' : '';
  switch (event.cancelledBy) {
    case FoodOrderCanceller.CONSUMER:
      return event.wasPaid
        ? {
            userIds: [event.storeOwnerUserId],
            message: foodOrderMessage(
              event,
              PushType.FOOD_ORDER_CANCELLED,
              '손님이 주문을 취소했어요',
              '접수하기 전에 취소된 주문이에요.',
            ),
            keepInInbox: true,
          }
        : null;
    case FoodOrderCanceller.STORE:
      return toConsumer(
        event,
        PushType.FOOD_ORDER_CANCELLED,
        `${event.storeName}에서 주문을 취소했어요`,
        `가게 사정으로 취소됐어요.${refund}`,
      );
    default:
      return {
        userIds: [event.consumerUserId, event.storeOwnerUserId],
        message: foodOrderMessage(
          event,
          PushType.FOOD_ORDER_CANCELLED,
          '주문이 취소됐어요',
          `고객센터에서 주문을 취소했어요.${refund}`,
        ),
        keepInInbox: true,
      };
  }
}

function foodOrderMessage(
  event: DomainEvent,
  type: PushType,
  title: string,
  body: string,
): PushMessage {
  return {
    category: PushCategory.ORDER_STATUS,
    title,
    body,
    // 한 주문의 진행 알림은 쌓지 않고 최신 상태만 남긴다.
    collapseKey: `food-order-${event.aggregateId}`.slice(0, 64),
    data: foodOrderData(type, event),
  };
}

function foodOrderData(
  type: PushType,
  event: DomainEvent,
): PushMessage['data'] {
  return { type, foodOrderId: event.aggregateId };
}

function toDriverAccount(
  userId: string,
  type: PushType,
  title: string,
  body: string,
): Notice {
  return {
    userIds: [userId],
    message: { category: PushCategory.ACCOUNT, title, body, data: { type } },
    keepInInbox: true,
  };
}

function statusMessage(
  event: DomainEvent,
  type: PushType,
  title: string,
  body: string,
): PushMessage {
  return {
    category: PushCategory.ORDER_STATUS,
    title,
    body,
    // 한 배달의 상태 알림은 쌓지 않고 최신 상태만 남긴다.
    collapseKey: `order-${event.aggregateId}`,
    data: orderData(type, event),
  };
}

function orderData(type: PushType, event: DomainEvent): PushMessage['data'] {
  return { type, orderId: event.aggregateId };
}

function won(amount: number): string {
  return `${amount.toLocaleString('ko-KR')}원`;
}
