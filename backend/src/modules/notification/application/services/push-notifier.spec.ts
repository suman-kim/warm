import { Notification } from '../../domain/entities/notification.entity.js';
import {
  PushCategory,
  PushMessage,
  PushType,
} from '../../domain/push-message.js';
import {
  NotificationRepository,
  NotificationSettingRepository,
} from '../../domain/repositories/notification.repositories.js';
import { PushDeviceRepository } from '../../domain/repositories/push-device.repository.js';
import { PushSender } from '../ports/push-sender.port.js';
import { PushNotifier } from './push-notifier.js';

const MESSAGE: PushMessage = {
  category: PushCategory.ORDER_STATUS,
  title: '기사님이 배차됐어요',
  body: '기사님이 픽업지로 출발해요.',
  data: { type: PushType.ORDER_ASSIGNED, orderId: 'order-1' },
};
const KEEP = { keepInInbox: true };
const SKIP = { keepInInbox: false };

function setup(
  tokensByUser: Record<string, string[]>,
  options: { invalid?: string[]; pushDisabled?: string[] } = {},
) {
  const sends: string[][] = [];
  const deleted: string[][] = [];
  const inbox: Notification[] = [];
  const devices = {
    findTokensByUserIds: async (userIds: string[]) =>
      userIds.flatMap((userId) => tokensByUser[userId] ?? []),
    deleteByTokens: async (tokens: string[]) => void deleted.push(tokens),
  } as PushDeviceRepository;
  const notifications = {
    saveAll: async (items: Notification[]) => void inbox.push(...items),
  } as NotificationRepository;
  const settings = {
    findPushDisabled: async (userIds: string[]) =>
      new Set(
        userIds.filter((userId) => options.pushDisabled?.includes(userId)),
      ),
  } as NotificationSettingRepository;
  const sender: PushSender = {
    send: async (tokens) => {
      sends.push(tokens);
      return { invalidTokens: options.invalid ?? [] };
    },
  };
  return {
    notifier: new PushNotifier(devices, notifications, settings, sender),
    sends,
    deleted,
    inbox,
  };
}

describe('PushNotifier', () => {
  it('받는 사람들의 모든 기기로 한 번에 보낸다', async () => {
    const { notifier, sends, deleted } = setup({
      a: ['a-phone', 'a-tablet'],
      b: ['b-phone'],
    });

    await notifier.notifyUsers(['a', 'b'], MESSAGE, SKIP);

    expect(sends).toEqual([['a-phone', 'a-tablet', 'b-phone']]);
    expect(deleted).toEqual([]);
  });

  it('등록된 기기가 없으면 보내지 않는다', async () => {
    const { notifier, sends } = setup({});

    await notifier.notifyUsers(['a'], MESSAGE, SKIP);
    await notifier.notifyUsers([], MESSAGE, SKIP);

    expect(sends).toEqual([]);
  });

  it('더는 쓸 수 없는 토큰은 지운다', async () => {
    const { notifier, deleted } = setup(
      { a: ['alive', 'dead'] },
      { invalid: ['dead'] },
    );

    await notifier.notifyUsers(['a'], MESSAGE, SKIP);

    expect(deleted).toEqual([['dead']]);
  });

  it('알림함에 남기는 알림은 받는 사람마다 한 건씩 저장한다', async () => {
    const { notifier, inbox } = setup({ a: ['a-phone'] });

    await notifier.notifyUsers(['a', 'b'], MESSAGE, KEEP);

    expect(inbox).toMatchObject([
      { userId: 'a', type: PushType.ORDER_ASSIGNED, title: MESSAGE.title },
      { userId: 'b', type: PushType.ORDER_ASSIGNED, readAt: null },
    ]);
    expect(inbox[0].data).toEqual(MESSAGE.data);
  });

  it('금방 낡는 알림은 알림함에 남기지 않는다', async () => {
    const { notifier, inbox, sends } = setup({ a: ['a-phone'] });

    await notifier.notifyUsers(['a'], MESSAGE, SKIP);

    expect(inbox).toEqual([]);
    expect(sends).toEqual([['a-phone']]);
  });

  it('푸시를 꺼 둔 회원에게는 보내지 않지만 알림함에는 남긴다', async () => {
    const { notifier, sends, inbox } = setup(
      { a: ['a-phone'], b: ['b-phone'] },
      { pushDisabled: ['a'] },
    );

    await notifier.notifyUsers(['a', 'b'], MESSAGE, KEEP);

    expect(sends).toEqual([['b-phone']]);
    expect(inbox.map((notification) => notification.userId)).toEqual([
      'a',
      'b',
    ]);
  });
});
