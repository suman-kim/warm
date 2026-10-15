import type { BatchResponse, MulticastMessage } from 'firebase-admin/messaging';
import {
  PushCategory,
  PushMessage,
  PushType,
} from '../../domain/push-message.js';
import { FcmMessaging, FcmPushSender } from './fcm-push.sender.js';

const NEW_ORDER: PushMessage = {
  category: PushCategory.NEW_ORDER,
  title: '새 주문이 들어왔어요',
  body: '서울 강남구 → 서울 마포구 · 33,200원',
  data: { type: PushType.ORDER_REQUESTED, orderId: 'order-1' },
};
const STATUS: PushMessage = {
  category: PushCategory.ORDER_STATUS,
  title: '기사님이 배차됐어요',
  body: '기사님이 픽업지로 출발해요.',
  collapseKey: 'order-order-1',
  data: { type: PushType.ORDER_ASSIGNED, orderId: 'order-1' },
};

/** 토큰마다 정해 둔 오류 코드로 답하는 가짜 FCM. 코드가 없는 토큰은 성공. */
function fakeMessaging(errorCodes: Record<string, string> = {}) {
  const calls: MulticastMessage[] = [];
  const messaging: FcmMessaging = {
    sendEachForMulticast: async (request) => {
      // 이 발송기는 토큰 목록으로만 보낸다 (설치 ID로 보내는 형식은 쓰지 않는다).
      const message = request as MulticastMessage;
      calls.push(message);
      const responses = message.tokens.map((token) =>
        errorCodes[token]
          ? { success: false, error: { code: errorCodes[token] } }
          : { success: true, messageId: `id-${token}` },
      );
      return { responses } as BatchResponse;
    },
  };
  return { messaging, calls };
}

describe('FcmPushSender', () => {
  it('제목·본문·data와 Android 채널을 실어 보낸다', async () => {
    const { messaging, calls } = fakeMessaging();

    const result = await new FcmPushSender(messaging).send(['t1'], NEW_ORDER);

    expect(result).toEqual({ invalidTokens: [] });
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      tokens: ['t1'],
      notification: { title: NEW_ORDER.title, body: NEW_ORDER.body },
      data: { type: 'ORDER_REQUESTED', orderId: 'order-1' },
      android: {
        priority: 'high',
        notification: { channelId: 'new-orders' },
      },
      apns: { headers: { 'apns-priority': '10' } },
    });
    // collapseKey가 없으면 관련 필드를 싣지 않는다 (알림이 각각 쌓인다).
    expect(calls[0].android).not.toHaveProperty('collapseKey');
    expect(calls[0].apns?.headers).not.toHaveProperty('apns-collapse-id');
  });

  it('collapseKey가 있으면 같은 주문의 알림이 하나로 갱신되게 한다', async () => {
    const { messaging, calls } = fakeMessaging();

    await new FcmPushSender(messaging).send(['t1'], STATUS);

    expect(calls[0]).toMatchObject({
      android: {
        collapseKey: 'order-order-1',
        notification: { channelId: 'order-status', tag: 'order-order-1' },
      },
      apns: { headers: { 'apns-collapse-id': 'order-order-1' } },
    });
  });

  it('앱을 지운 기기의 토큰만 무효로 돌려준다', async () => {
    const { messaging } = fakeMessaging({
      gone: 'messaging/registration-token-not-registered',
      malformed: 'messaging/invalid-registration-token',
      // 알림 내용이 틀렸거나 FCM이 잠깐 안 될 때 — 토큰 탓이 아니다.
      badPayload: 'messaging/invalid-argument',
      busy: 'messaging/server-unavailable',
    });

    const result = await new FcmPushSender(messaging).send(
      ['ok', 'gone', 'malformed', 'badPayload', 'busy'],
      NEW_ORDER,
    );

    expect(result.invalidTokens).toEqual(['gone', 'malformed']);
  });

  it('500대를 넘으면 나눠 보낸다', async () => {
    const { messaging, calls } = fakeMessaging({
      't-1200': 'messaging/registration-token-not-registered',
    });
    const tokens = Array.from({ length: 1201 }, (_, i) => `t-${i}`);

    const result = await new FcmPushSender(messaging).send(tokens, NEW_ORDER);

    expect(calls.map((call) => call.tokens.length)).toEqual([500, 500, 201]);
    expect(calls.flatMap((call) => call.tokens)).toEqual(tokens);
    expect(result.invalidTokens).toEqual(['t-1200']);
  });
});
