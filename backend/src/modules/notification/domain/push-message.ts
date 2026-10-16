/**
 * 푸시 묶음. Android 알림 채널의 단위다 — 앱이 묶음마다 소리·중요도를 따로 정한다.
 */
export enum PushCategory {
  /** 라이더에게 가는 새 콜 */
  NEW_ORDER = 'NEW_ORDER',
  /** 내 배달의 상태 변화 */
  ORDER_STATUS = 'ORDER_STATUS',
  /** 내 계정에 관한 소식 (라이더 심사 결과 등) */
  ACCOUNT = 'ACCOUNT',
}

/** 알림 종류. 앱이 `data.type`으로 받아 어느 화면을 열지 정한다. */
export enum PushType {
  ORDER_REQUESTED = 'ORDER_REQUESTED',
  ORDER_ASSIGNED = 'ORDER_ASSIGNED',
  ORDER_DEPARTED = 'ORDER_DEPARTED',
  ORDER_ARRIVED = 'ORDER_ARRIVED',
  ORDER_PICKED_UP = 'ORDER_PICKED_UP',
  ORDER_DELIVERED = 'ORDER_DELIVERED',
  ORDER_CANCELLED = 'ORDER_CANCELLED',
  DRIVER_APPROVED = 'DRIVER_APPROVED',
  DRIVER_REJECTED = 'DRIVER_REJECTED',
  /** 주문앱(따끈): 가게에 새 주문 */
  FOOD_ORDER_PLACED = 'FOOD_ORDER_PLACED',
  /** 주문앱: 손님에게 가는 주문 진행 */
  FOOD_ORDER_ACCEPTED = 'FOOD_ORDER_ACCEPTED',
  FOOD_ORDER_REJECTED = 'FOOD_ORDER_REJECTED',
  FOOD_ORDER_PICKED_UP = 'FOOD_ORDER_PICKED_UP',
  FOOD_ORDER_DELIVERED = 'FOOD_ORDER_DELIVERED',
  /** 주문앱: 취소 (손님이 취소하면 가게에, 가게가 취소하면 손님에게, 운영자가 취소하면 둘 다) */
  FOOD_ORDER_CANCELLED = 'FOOD_ORDER_CANCELLED',
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
