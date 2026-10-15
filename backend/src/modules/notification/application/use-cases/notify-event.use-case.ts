import { Inject, Injectable } from '@nestjs/common';
import { DomainEvent } from '../../../../common/domain/domain-event.js';
import {
  DriverApprovedEvent,
  DriverRejectedEvent,
} from '../../../driver/domain/events/driver.events.js';
import {
  OrderArrivedEvent,
  OrderAssignedEvent,
  OrderCancelledEvent,
  OrderDeliveredEvent,
  OrderDepartedEvent,
  OrderMessageSentEvent,
  OrderNoShowEvent,
  OrderPaymentFailedEvent,
  OrderPickedUpEvent,
  OrderRequestedEvent,
} from '../../../order/domain/events/order.events.js';
import { ChargePolicy } from '../../../order/domain/services/charge-policy.js';
import { ChargeKind } from '../../../payment/domain/entities/order-charge.entity.js';
import {
  OrderAdditionalChargeFailedEvent,
  OrderChargePaidEvent,
  OrderRefundedEvent,
} from '../../../payment/domain/events/payment.events.js';
import { failureGuide } from '../../../payment/domain/payment-failure.js';
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
  /** 알림함에도 남길지. 금방 낡는 알림(새 콜, 메시지)은 남기지 않는다. */
  keepInInbox: boolean;
}

/**
 * 다른 컨텍스트에서 일어난 일을 알림으로 바꾸는 유스케이스. 누구에게 무엇을 보낼지 여기서 정한다.
 *
 * | 일어난 일                                  | 받는 사람                           | 알림함 |
 * | ------------------------------------------ | ----------------------------------- | ------ |
 * | 배송 요청 (다시 요청 포함)                 | 그 차종의 운행 중인 기사 전원       | ✕      |
 * | 배차·출발·도착·픽업·배송 완료·노쇼         | 고객                                | ○      |
 * | 결제 완료·결제 실패·추가 결제(실패)·환불   | 고객                                | ○      |
 * | 주문 취소                                  | 배차돼 있던 기사 (배차 전이면 없음) | ○      |
 * | 메시지                                     | 받는 쪽 (고객 또는 기사)            | ✕      |
 * | 기사 승인·반려                             | 그 기사                             | ○      |
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
        // 픽업지 근처에서 최근 위치를 보낸 기사에게만 알린다.
        userIds: await this.audience.findAvailableDriverUserIds(
          event.vehicleType,
          { ...event.pickupPoint, radiusKm: event.dispatchRadiusKm },
        ),
        message: {
          category: PushCategory.NEW_ORDER,
          title: '새 주문이 들어왔어요',
          // 배차 대기 목록에 보이는 것과 같은 범위만 싣는다 (동 단위 위치와 요금).
          body: `${event.pickupArea} → ${event.dropoffArea} · ${event.fareAmount.toLocaleString('ko-KR')}원`,
          data: orderData(PushType.ORDER_REQUESTED, event),
        },
        keepInInbox: false,
      };
    }
    if (event instanceof OrderAssignedEvent) {
      return toCustomer(
        event,
        PushType.ORDER_ASSIGNED,
        '기사님이 배차됐어요',
        '기사님이 곧 출발해요. 출발하면 알려 드릴게요.',
      );
    }
    if (event instanceof OrderPaymentFailedEvent) {
      const guide = failureGuide(event.failureCode);
      return toCustomer(
        event,
        PushType.ORDER_PAYMENT_FAILED,
        '결제가 안 돼 배차되지 않았어요',
        `${guide?.title ?? '결제 실패'} · 다른 카드로 다시 요청해 주세요.`,
      );
    }
    if (event instanceof OrderDepartedEvent) {
      return toCustomer(
        event,
        PushType.ORDER_DEPARTED,
        '기사님이 출발했어요',
        `지금부터 취소하면 요금의 ${ChargePolicy.rules.cancellationFeePercent}%가 수수료로 나가요.`,
      );
    }
    if (event instanceof OrderArrivedEvent) {
      return toCustomer(
        event,
        PushType.ORDER_ARRIVED,
        '기사님이 픽업지에 도착했어요',
        `물품을 기사님께 전해 주세요. ${ChargePolicy.rules.freeWaitingMinutes}분이 지나면 대기료가 붙어요.`,
      );
    }
    if (event instanceof OrderNoShowEvent) {
      return toCustomer(
        event,
        PushType.ORDER_NO_SHOW,
        '노쇼로 처리됐어요',
        `기사님이 ${ChargePolicy.rules.noShowWaitMinutes}분을 기다렸어요. 요금 ${won(event.fareAmount)}은 환불되지 않아요.`,
      );
    }
    if (event instanceof OrderChargePaidEvent) {
      const additional = event.kind === ChargeKind.ADDITIONAL;
      return toCustomer(
        event,
        additional ? PushType.PAYMENT_ADDITIONAL_PAID : PushType.PAYMENT_PAID,
        additional
          ? `추가 요금 ${won(event.amount)}을 결제했어요`
          : `${won(event.amount)}을 결제했어요`,
        `${event.routeLabel} · ${event.cardLabel}`,
      );
    }
    if (event instanceof OrderAdditionalChargeFailedEvent) {
      const guide = failureGuide(event.failureCode);
      return toCustomer(
        event,
        PushType.PAYMENT_ADDITIONAL_FAILED,
        `추가 요금 ${won(event.amount)}을 결제하지 못했어요`,
        `${event.routeLabel} · ${guide?.title ?? '결제 실패'} · 고객센터에서 안내해 드려요.`,
      );
    }
    if (event instanceof OrderRefundedEvent) {
      return toCustomer(
        event,
        PushType.PAYMENT_REFUNDED,
        `${won(event.amount)}을 환불했어요`,
        event.cancellationFee > 0
          ? `${event.routeLabel} · 취소 수수료 ${won(event.cancellationFee)}을 뺐어요`
          : `${event.routeLabel} · ${event.reason}`,
      );
    }
    if (event instanceof OrderPickedUpEvent) {
      return toCustomer(
        event,
        PushType.ORDER_PICKED_UP,
        '픽업이 완료됐어요',
        '화물을 싣고 도착지로 가고 있어요.',
      );
    }
    if (event instanceof OrderDeliveredEvent) {
      return toCustomer(
        event,
        PushType.ORDER_DELIVERED,
        '배송이 완료됐어요',
        '이용해 주셔서 감사해요.',
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
              '주문이 취소됐어요',
              '고객이 배차된 주문을 취소했어요.',
            ),
            keepInInbox: true,
          }
        : null;
    }
    if (event instanceof OrderMessageSentEvent) {
      return {
        userIds: [event.recipientUserId],
        message: {
          category: PushCategory.MESSAGE,
          title: event.senderName,
          body: event.text,
          data: orderData(PushType.ORDER_MESSAGE, event),
        },
        keepInInbox: false,
      };
    }
    if (event instanceof DriverApprovedEvent) {
      return toDriverAccount(
        event.userId,
        PushType.DRIVER_APPROVED,
        '가입이 승인됐어요',
        '운행을 시작하면 콜을 받을 수 있어요.',
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
    // 한 주문의 상태 알림은 쌓지 않고 최신 상태만 남긴다.
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
