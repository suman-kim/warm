import { Logger } from '@nestjs/common';
import {
  PushSendResult,
  PushSender,
} from '../../application/ports/push-sender.port.js';
import { PushMessage } from '../../domain/push-message.js';

/**
 * 보내지 않는 발송 구현. Firebase 서비스 계정이 없을 때 쓴다.
 * 무엇이 몇 대에 나갔을지는 로그로 남겨, Firebase 없이도 "이 상황에서 푸시가 나가는가"를
 * 개발 중에 확인할 수 있다.
 */
export class DisabledPushSender implements PushSender {
  private readonly logger = new Logger(DisabledPushSender.name);

  constructor() {
    this.logger.warn(
      '푸시 발송이 꺼져 있어요 (FIREBASE_SERVICE_ACCOUNT_BASE64 없음). 보낼 알림은 로그로만 남겨요.',
    );
  }

  send(tokens: string[], message: PushMessage): Promise<PushSendResult> {
    this.logger.log(
      `푸시 미발송: ${message.data.type} "${message.title}" → 기기 ${tokens.length}대`,
    );
    return Promise.resolve({ invalidTokens: [] });
  }
}
