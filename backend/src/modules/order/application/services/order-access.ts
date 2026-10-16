import { Inject, Injectable } from '@nestjs/common';
import { AuthenticatedUser } from '../../../../common/application/authenticated-user.js';
import { NotFoundError } from '../../../../common/domain/domain-error.js';
import { UserRole } from '../../../../common/domain/user-role.js';
import { Order } from '../../domain/entities/order.entity.js';
import {
  ORDER_REPOSITORY,
  type OrderRepository,
} from '../../domain/repositories/order.repository.js';
import {
  DRIVER_DIRECTORY,
  type DispatchDriver,
  type DriverDirectory,
} from '../ports/driver-directory.port.js';

/** 주문과, 그 주문을 보는 사람의 관계. */
export interface OrderView {
  order: Order;
  /** 요청한 사람이 이 주문에 배차된 기사일 때만 있다. */
  viewerDriver: DispatchDriver | null;
}

/**
 * 주문을 볼 수 있는 사람인지 확인하고 읽어 온다.
 * 요청한 고객, 배차된 기사, 운영자만 볼 수 있다. 그 밖에는 없는 주문처럼 답한다.
 */
@Injectable()
export class OrderAccess {
  constructor(
    @Inject(ORDER_REPOSITORY)
    private readonly orderRepository: OrderRepository,
    @Inject(DRIVER_DIRECTORY)
    private readonly driverDirectory: DriverDirectory,
  ) {}

  async load(
    requester: AuthenticatedUser,
    orderId: string,
  ): Promise<OrderView> {
    const order = await this.orderRepository.findById(orderId);
    if (order) {
      if (requester.role === UserRole.ADMIN) {
        return { order, viewerDriver: null };
      }
      if (
        requester.role === UserRole.CUSTOMER &&
        order.isOwnedBy(requester.id)
      ) {
        return { order, viewerDriver: null };
      }
      if (requester.role === UserRole.DRIVER) {
        const driver = await this.driverDirectory.findByUserId(requester.id);
        if (driver && order.isAssignedTo(driver.id)) {
          return { order, viewerDriver: driver };
        }
      }
    }
    throw new NotFoundError('ORDER_NOT_FOUND', '배달을 찾을 수 없어요.');
  }
}
