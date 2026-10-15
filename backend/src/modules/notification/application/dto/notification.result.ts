import { PushType } from '../../domain/push-message.js';

/** 알림함의 알림 한 건 */
export class NotificationResult {
  id: string;
  type: PushType;
  title: string;
  body: string;
  /** 눌렀을 때 갈 곳을 정하는 값 (예: orderId) */
  data: Record<string, string>;
  /** 읽은 시각. 아직 안 읽었으면 null. */
  readAt: Date | null;
  createdAt: Date;
}

/** 알림함 응답. */
export class NotificationPageResult {
  items: NotificationResult[];
  total: number;
  page: number;
  size: number;
  /** 안 읽은 알림 수 (페이지와 무관한 전체) */
  unreadCount: number;
}

export class UnreadCountResult {
  unreadCount: number;
}

/** 알림 설정 응답. */
export class NotificationSettingResult {
  /** 푸시 알림을 받을지. 꺼도 알림함에는 쌓인다. */
  pushEnabled: boolean;
}
