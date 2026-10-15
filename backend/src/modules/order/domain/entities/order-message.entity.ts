import { InvalidArgumentError } from '../../../../common/domain/domain-error.js';

const MAX_TEXT_LENGTH = 500;

/** 주문 하나를 두고 고객과 배차된 기사가 주고받는 메시지. */
export class OrderMessage {
  constructor(
    readonly id: string,
    readonly orderId: string,
    readonly senderUserId: string,
    readonly text: string,
    readonly createdAt: Date,
  ) {}

  static write(input: {
    id: string;
    orderId: string;
    senderUserId: string;
    text: string;
    now: Date;
  }): OrderMessage {
    const text = input.text.trim();
    if (text.length < 1 || text.length > MAX_TEXT_LENGTH) {
      throw new InvalidArgumentError(
        'INVALID_MESSAGE',
        `메시지는 1~${MAX_TEXT_LENGTH}자로 입력해 주세요.`,
      );
    }
    return new OrderMessage(
      input.id,
      input.orderId,
      input.senderUserId,
      text,
      input.now,
    );
  }
}
