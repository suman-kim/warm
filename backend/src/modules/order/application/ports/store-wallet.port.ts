import type { Order } from '../../domain/entities/order.entity.js';

/** 가게 조회·충전금 포트 DI 토큰. */
export const STORE_WALLET = Symbol('STORE_WALLET');

/** 배달을 요청하는 가게. 주소가 픽업지다. */
export interface DeliveryStore {
  id: string;
  /** 사장님 회원 ID */
  ownerUserId: string;
  name: string;
  phone: string;
  address: string;
  detailAddress: string | null;
  sigungu: string;
  dong: string;
  latitude: number;
  longitude: number;
  approved: boolean;
  walletBalance: number;
}

/**
 * 주문 컨텍스트가 가게 컨텍스트를 직접 알지 않도록 사이에 둔다.
 * 배달대행료는 가게 충전금에서 빼고, 취소되면 돌려준다.
 */
export interface StoreWallet {
  /** 사장님의 가게. 등록하지 않았으면 null. */
  findByOwner(ownerUserId: string): Promise<DeliveryStore | null>;
  /** 가게 ID로 찾는다. 없으면 null. */
  findById(storeId: string): Promise<DeliveryStore | null>;
  /** 대행료를 뺀다. 승인 전이거나 잔액이 모자라면 ConflictError. */
  chargeDeliveryFee(
    storeId: string,
    orderId: string,
    amount: number,
    memo: string,
  ): Promise<void>;
  /** 취소된 배달의 대행료를 돌려준다. */
  refundDeliveryFee(
    storeId: string,
    orderId: string,
    amount: number,
    memo: string,
  ): Promise<void>;
}

/** 충전금 내역에 남길 배달 이름: 손님 동 · 주문번호 끝자리 (역삼동 · 3F9A). 덧붙일 말이 있으면 뒤에 붙인다. */
export function walletMemo(order: Order, note?: string): string {
  const { dropoff } = order.snapshot();
  return [dropoff.dong, order.code.slice(-4), note].filter(Boolean).join(' · ');
}
