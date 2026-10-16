import { DomainEvent } from '../../../../common/domain/domain-event.js';
import {
  DriverApprovedEvent,
  DriverRejectedEvent,
} from '../../../driver/domain/events/driver.events.js';
import {
  OrderAssignedEvent,
  OrderCancelledEvent,
  OrderDeliveredEvent,
  OrderPickedUpEvent,
  OrderRequestedEvent,
} from '../../../order/domain/events/order.events.js';
import {
  PushCategory,
  PushMessage,
  PushType,
} from '../../domain/push-message.js';
import { PushAudience } from '../ports/push-audience.port.js';
import { PushNotifier } from '../services/push-notifier.js';
import { NotifyEventUseCase } from './notify-event.use-case.js';

const AT = new Date('2026-10-13T09:00:00Z');

interface Sent {
  userIds: string[];
  message: PushMessage;
  keepInInbox: boolean;
}

function setup(
  audience: { available?: string[]; driverUserId?: string | null } = {},
) {
  const sent: Sent[] = [];
  const askedNear: { latitude: number; longitude: number; radiusKm: number }[] =
    [];
  const pushAudience: PushAudience = {
    findAvailableDriverUserIds: async (near) => {
      askedNear.push(near);
      return audience.available ?? [];
    },
    findDriverUserId: async () => audience.driverUserId ?? null,
  };
  const notifier = {
    notifyUsers: async (
      userIds: string[],
      message: PushMessage,
      options: { keepInInbox: boolean },
    ) => void sent.push({ userIds, message, ...options }),
  } as PushNotifier;
  return {
    useCase: new NotifyEventUseCase(pushAudience, notifier),
    sent,
    askedNear,
  };
}

describe('NotifyEventUseCase', () => {
  it('새 콜은 가게 근처에서 운행 중인 라이더들에게만, 알림함에 남기지 않고 알린다', async () => {
    const { useCase, sent, askedNear } = setup({
      available: ['driver-user-1', 'driver-user-2'],
    });

    await useCase.execute(
      new OrderRequestedEvent(
        'order-1',
        AT,
        'customer-1',
        '강남구 역삼동',
        '강남구 대치동',
        3500,
        { latitude: 37.5, longitude: 127.0364 },
        5,
      ),
    );

    expect(askedNear).toEqual([
      { latitude: 37.5, longitude: 127.0364, radiusKm: 5 },
    ]);
    expect(sent).toEqual([
      {
        userIds: ['driver-user-1', 'driver-user-2'],
        keepInInbox: false,
        message: {
          category: PushCategory.NEW_ORDER,
          title: '새 콜이 들어왔어요',
          body: '강남구 역삼동 → 강남구 대치동 · 대행료 3,500원',
          data: { type: PushType.ORDER_REQUESTED, orderId: 'order-1' },
        },
      },
    ]);
  });

  it.each([
    [
      new OrderAssignedEvent('order-1', AT, 'customer-1', 'driver-1'),
      PushType.ORDER_ASSIGNED,
    ],
    [
      new OrderPickedUpEvent('order-1', AT, 'customer-1', 'driver-1'),
      PushType.ORDER_PICKED_UP,
    ],
    [
      new OrderDeliveredEvent('order-1', AT, 'customer-1', 'driver-1'),
      PushType.ORDER_DELIVERED,
    ],
  ])('%o 는 사장님에게 알리고 알림함에 남긴다', async (event, type) => {
    const { useCase, sent } = setup();

    await useCase.execute(event);

    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({
      userIds: ['customer-1'],
      keepInInbox: true,
      message: {
        category: PushCategory.ORDER_STATUS,
        // 한 배달의 상태 알림은 기기에서 최신 것 하나로 합쳐진다.
        collapseKey: 'order-order-1',
        data: { type, orderId: 'order-1' },
      },
    });
  });

  it('배차된 뒤에 취소되면 그 라이더에게 알린다', async () => {
    const { useCase, sent } = setup({ driverUserId: 'driver-user-1' });

    await useCase.execute(
      new OrderCancelledEvent('order-1', AT, 'customer-1', 'driver-1'),
    );

    expect(sent).toMatchObject([
      {
        userIds: ['driver-user-1'],
        keepInInbox: true,
        message: { data: { type: PushType.ORDER_CANCELLED } },
      },
    ]);
  });

  it('배차 전에 취소되면 알릴 사람이 없다', async () => {
    const { useCase, sent } = setup({ driverUserId: 'driver-user-1' });

    await useCase.execute(
      new OrderCancelledEvent('order-1', AT, 'customer-1', null),
    );

    expect(sent).toEqual([]);
  });

  it('라이더 승인·반려는 그 라이더에게 알리고, 반려 사유를 본문에 싣는다', async () => {
    const { useCase, sent } = setup();

    await useCase.execute(new DriverApprovedEvent('driver-1', AT, 'user-1'));
    await useCase.execute(
      new DriverRejectedEvent('driver-1', AT, 'user-1', '번호판이 안 보여요'),
    );

    expect(sent).toMatchObject([
      {
        userIds: ['user-1'],
        keepInInbox: true,
        message: {
          category: PushCategory.ACCOUNT,
          data: { type: PushType.DRIVER_APPROVED },
        },
      },
      {
        userIds: ['user-1'],
        keepInInbox: true,
        message: {
          body: '번호판이 안 보여요',
          data: { type: PushType.DRIVER_REJECTED },
        },
      },
    ]);
  });

  it('알릴 일이 아닌 이벤트는 넘어간다', async () => {
    class SomethingElse extends DomainEvent {
      readonly eventName = 'something.else';
    }
    const { useCase, sent } = setup();

    await useCase.execute(new SomethingElse('x', AT));

    expect(sent).toEqual([]);
  });
});
