import { PushMessage, PushType } from '../push-message.js';

/** 알림함에 쌓이는 알림 한 건. 푸시를 놓쳤어도 앱에서 다시 볼 수 있다. */
export class Notification {
  constructor(
    readonly id: string,
    readonly userId: string,
    readonly type: PushType,
    readonly title: string,
    readonly body: string,
    /** 눌렀을 때 갈 곳을 정하는 값 (예: orderId) */
    readonly data: Record<string, string>,
    readonly readAt: Date | null,
    readonly createdAt: Date,
  ) {}

  static from(
    id: string,
    userId: string,
    message: PushMessage,
    now: Date,
  ): Notification {
    return new Notification(
      id,
      userId,
      message.data.type,
      message.title,
      message.body,
      message.data,
      null,
      now,
    );
  }
}
