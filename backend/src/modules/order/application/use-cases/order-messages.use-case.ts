import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { AuthenticatedUser } from '../../../../common/application/authenticated-user.js';
import {
  DOMAIN_EVENT_PUBLISHER,
  type DomainEventPublisher,
} from '../../../../common/application/domain-event-publisher.port.js';
import { ConflictError } from '../../../../common/domain/domain-error.js';
import { UserRole } from '../../../../common/domain/user-role.js';
import { OrderMessage } from '../../domain/entities/order-message.entity.js';
import { OrderMessageSentEvent } from '../../domain/events/order.events.js';
import {
  ORDER_MESSAGE_REPOSITORY,
  type OrderMessageRepository,
} from '../../domain/repositories/order-message.repository.js';
import { MessageResult, toMessageResult } from '../dto/order.result.js';
import {
  DRIVER_DIRECTORY,
  type DriverDirectory,
} from '../ports/driver-directory.port.js';
import { OrderAccess } from '../services/order-access.js';

const MAX_PAGE = 200;

/**
 * 주문 메시지 유스케이스. 주문을 요청한 고객과 배차된 기사가 주고받는다.
 * 읽기는 주문이 끝난 뒤에도 되고, 보내기는 배송이 진행 중일 때만 된다.
 */
@Injectable()
export class OrderMessagesUseCase {
  constructor(
    private readonly orderAccess: OrderAccess,
    @Inject(ORDER_MESSAGE_REPOSITORY)
    private readonly messageRepository: OrderMessageRepository,
    @Inject(DRIVER_DIRECTORY)
    private readonly driverDirectory: DriverDirectory,
    @Inject(DOMAIN_EVENT_PUBLISHER)
    private readonly eventPublisher: DomainEventPublisher,
  ) {}

  /** [after]를 주면 그 뒤에 온 메시지만 준다 (대화 화면이 새 메시지를 확인할 때). */
  async list(
    requester: AuthenticatedUser,
    orderId: string,
    after?: Date,
  ): Promise<MessageResult[]> {
    const { order } = await this.orderAccess.load(requester, orderId);
    const messages = await this.messageRepository.findByOrder(order.id, {
      after,
      limit: MAX_PAGE,
    });
    return messages.map((message) => toMessageResult(message, requester.id));
  }

  async send(
    requester: AuthenticatedUser,
    orderId: string,
    text: string,
  ): Promise<MessageResult> {
    const { order, viewerDriver } = await this.orderAccess.load(
      requester,
      orderId,
    );
    const driverId = order.driverId;
    if (
      requester.role === UserRole.ADMIN ||
      !order.isInProgress() ||
      !driverId
    ) {
      throw new ConflictError(
        'ORDER_NOT_IN_PROGRESS',
        '배송이 진행 중일 때만 메시지를 보낼 수 있어요.',
      );
    }
    const now = new Date();
    const message = OrderMessage.write({
      id: randomUUID(),
      orderId: order.id,
      senderUserId: requester.id,
      text,
      now,
    });
    await this.messageRepository.save(message);

    // 받는 쪽: 기사가 보냈으면 고객, 고객이 보냈으면 배차된 기사.
    const recipientUserId = viewerDriver
      ? order.customerId
      : (await this.driverDirectory.findById(driverId))?.userId;
    if (recipientUserId) {
      await this.eventPublisher.publishAll([
        new OrderMessageSentEvent(
          order.id,
          now,
          recipientUserId,
          viewerDriver ? `${viewerDriver.name} 기사님` : '고객님',
          message.text,
        ),
      ]);
    }
    return toMessageResult(message, requester.id);
  }
}
