/**
 * 푸시 묶음. Android 알림 채널의 단위다 — 앱이 묶음마다 소리·중요도를 따로 정한다.
 */
export enum PushCategory {
  /** 기사에게 가는 새 주문 */
  NEW_ORDER = 'NEW_ORDER',
  /** 내 주문·배송의 상태 변화 */
  ORDER_STATUS = 'ORDER_STATUS',
  /** 고객과 기사가 주고받는 메시지 */
  MESSAGE = 'MESSAGE',
  /** 내 계정에 관한 소식 (기사 심사 결과 등) */
  ACCOUNT = 'ACCOUNT',
}

/** 알림 종류. 앱이 `data.type`으로 받아 어느 화면을 열지 정한다. */
export enum PushType {
  ORDER_REQUESTED = 'ORDER_REQUESTED',
  ORDER_ASSIGNED = 'ORDER_ASSIGNED',
  /** 배차 때 결제가 안 돼 배차되지 않았다 (고객) */
  ORDER_PAYMENT_FAILED = 'ORDER_PAYMENT_FAILED',
  ORDER_DEPARTED = 'ORDER_DEPARTED',
  ORDER_ARRIVED = 'ORDER_ARRIVED',
  ORDER_PICKED_UP = 'ORDER_PICKED_UP',
  ORDER_DELIVERED = 'ORDER_DELIVERED',
  ORDER_CANCELLED = 'ORDER_CANCELLED',
  ORDER_NO_SHOW = 'ORDER_NO_SHOW',
  /** 배차 때 결제했다 */
  PAYMENT_PAID = 'PAYMENT_PAID',
  /** 픽업 때 추가 요금을 결제했다 */
  PAYMENT_ADDITIONAL_PAID = 'PAYMENT_ADDITIONAL_PAID',
  /** 픽업 때 추가 요금을 결제하지 못했다 */
  PAYMENT_ADDITIONAL_FAILED = 'PAYMENT_ADDITIONAL_FAILED',
  PAYMENT_REFUNDED = 'PAYMENT_REFUNDED',
  ORDER_MESSAGE = 'ORDER_MESSAGE',
  DRIVER_APPROVED = 'DRIVER_APPROVED',
  DRIVER_REJECTED = 'DRIVER_REJECTED',
}

/** 기기로 보낼 알림 한 건. 어느 발송 수단(FCM)으로 나가는지는 모른다. */
export interface PushMessage {
  category: PushCategory;
  title: string;
  body: string;
  /** 같은 키의 알림은 기기에서 쌓이지 않고 최신 것으로 바뀐다. 64바이트 이하. */
  collapseKey?: string;
  /** 앱이 받는 값. `type`은 항상 있다. 발송 규격상 값은 문자열만 된다. */
  data: { type: PushType } & Record<string, string>;
}
