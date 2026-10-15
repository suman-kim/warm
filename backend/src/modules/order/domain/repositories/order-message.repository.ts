import { OrderMessage } from '../entities/order-message.entity.js';

/** 주문 메시지 저장소 DI 토큰. */
export const ORDER_MESSAGE_REPOSITORY = Symbol('ORDER_MESSAGE_REPOSITORY');

/** 주문 메시지 저장소 계약. */
export interface OrderMessageRepository {
  save(message: OrderMessage): Promise<void>;
  /** 보낸 순서대로. [after]를 주면 그 시각 뒤에 온 것만 (새 메시지 확인용). */
  findByOrder(
    orderId: string,
    options: { after?: Date; limit: number },
  ): Promise<OrderMessage[]>;
}
