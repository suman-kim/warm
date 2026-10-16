import { Inject, Injectable } from '@nestjs/common';
import { AuthenticatedUser } from '../../../../common/application/authenticated-user.js';
import { OrderDetailResult, toOrderDetailResult } from '../dto/order.result.js';
import {
  DRIVER_DIRECTORY,
  type DriverDirectory,
} from '../ports/driver-directory.port.js';
import { OrderAccess } from '../services/order-access.js';

/** 배달 상세 조회 유스케이스. 배차된 라이더를 함께 준다. */
@Injectable()
export class GetOrderUseCase {
  constructor(
    private readonly orderAccess: OrderAccess,
    @Inject(DRIVER_DIRECTORY)
    private readonly driverDirectory: DriverDirectory,
  ) {}

  async execute(
    requester: AuthenticatedUser,
    orderId: string,
  ): Promise<OrderDetailResult> {
    const { order } = await this.orderAccess.load(requester, orderId);
    const driver = order.driverId
      ? await this.driverDirectory.findById(order.driverId)
      : null;
    return toOrderDetailResult(order, driver);
  }
}
