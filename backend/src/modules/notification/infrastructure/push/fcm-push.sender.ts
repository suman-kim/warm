import { Logger } from '@nestjs/common';
import type { Messaging, MulticastMessage } from 'firebase-admin/messaging';
import {
  PushSendResult,
  PushSender,
} from '../../application/ports/push-sender.port.js';
import { PushCategory, PushMessage } from '../../domain/push-message.js';

/** 발송에 쓰는 FCM 기능만. 테스트에서 바꿔 끼운다. */
export type FcmMessaging = Pick<Messaging, 'sendEachForMulticast'>;

/** FCM이 한 번에 받는 토큰 수. */
const MULTICAST_LIMIT = 500;

/** Android 알림 채널 ID. 앱이 같은 ID로 채널을 만들어 둬야 소리·중요도가 적용된다. */
export const ANDROID_CHANNEL_IDS: Record<PushCategory, string> = {
  [PushCategory.NEW_ORDER]: 'new-orders',
  [PushCategory.ORDER_STATUS]: 'order-status',
  [PushCategory.MESSAGE]: 'messages',
  [PushCategory.ACCOUNT]: 'account',
};

/**
 * 이 토큰으로는 다시 보낼 수 없다는 뜻의 오류. 앱을 지웠거나 토큰이 새로 발급됐다.
 * 'invalid-argument'는 넣지 않는다 — 토큰이 아니라 알림 내용이 틀렸을 때도 같은 코드가
 * 와서, 그걸로 지우면 실수 한 번에 멀쩡한 토큰이 전부 사라진다.
 */
const DEAD_TOKEN_CODES = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
]);

/**
 * FCM 발송 구현.
 * Android는 FCM이 직접, iOS는 FCM이 APNs로 넘겨 보낸다. 고객 앱과 기사 앱이 같은
 * Firebase 프로젝트에 등록돼 있으면 서비스 계정 하나로 두 앱 모두에 보낸다.
 */
export class FcmPushSender implements PushSender {
  private readonly logger = new Logger(FcmPushSender.name);

  constructor(private readonly messaging: FcmMessaging) {}

  async send(tokens: string[], message: PushMessage): Promise<PushSendResult> {
    const invalidTokens: string[] = [];
    let sent = 0;
    for (let i = 0; i < tokens.length; i += MULTICAST_LIMIT) {
      const chunk = tokens.slice(i, i + MULTICAST_LIMIT);
      const response = await this.messaging.sendEachForMulticast(
        toFcmMessage(chunk, message),
      );
      response.responses.forEach((each, index) => {
        if (each.success) {
          sent += 1;
          return;
        }
        const code = each.error?.code ?? 'unknown';
        if (DEAD_TOKEN_CODES.has(code)) {
          invalidTokens.push(chunk[index]);
        } else {
          // 토큰은 싣지 않는다(기기 식별자). 코드만으로 원인을 가릴 수 있다.
          this.logger.warn(`푸시 발송 거절: ${code} (${message.data.type})`);
        }
      });
    }
    this.logger.log(
      `${message.data.type} 발송: 성공 ${sent} / 대상 ${tokens.length}`,
    );
    return { invalidTokens };
  }
}

/** 알림 한 건을 FCM 규격으로 바꾼다. */
export function toFcmMessage(
  tokens: string[],
  message: PushMessage,
): MulticastMessage {
  const { collapseKey } = message;
  return {
    tokens,
    notification: { title: message.title, body: message.body },
    data: message.data,
    // 새 주문과 배송 상태는 모두 바로 알려야 한다 — 절전 중인 기기도 깨운다.
    android: {
      priority: 'high',
      ...(collapseKey ? { collapseKey } : {}),
      notification: {
        channelId: ANDROID_CHANNEL_IDS[message.category],
        // 같은 tag의 알림은 새로 쌓이지 않고 바뀐다.
        ...(collapseKey ? { tag: collapseKey } : {}),
      },
    },
    apns: {
      headers: {
        'apns-priority': '10',
        ...(collapseKey ? { 'apns-collapse-id': collapseKey } : {}),
      },
      payload: { aps: { sound: 'default' } },
    },
  };
}
