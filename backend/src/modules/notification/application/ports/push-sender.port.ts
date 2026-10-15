import { PushMessage } from '../../domain/push-message.js';

/** 푸시 발송 포트 DI 토큰. */
export const PUSH_SENDER = Symbol('PUSH_SENDER');

export interface PushSendResult {
  /** 더는 쓸 수 없다고 확인된 토큰(앱 삭제 등). 호출부가 저장소에서 지운다. */
  invalidTokens: string[];
}

/**
 * 기기로 알림을 내보내는 포트.
 * 구현은 FCM이고, 인증 정보가 없으면 보내지 않고 로그만 남기는 구현으로 바뀐다.
 */
export interface PushSender {
  /**
   * 토큰들로 같은 알림을 보낸다. 일부 기기가 실패해도 던지지 않는다.
   * 발송 서비스 자체에 닿지 못하면 던진다.
   */
  send(tokens: string[], message: PushMessage): Promise<PushSendResult>;
}
