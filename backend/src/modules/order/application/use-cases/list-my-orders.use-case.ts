import { Inject, Injectable } from '@nestjs/common';
import {
  PageQuery,
  toPageRequest,
} from '../../../../common/application/page.js';
import {
  ORDER_REPOSITORY,
  type OrderFilter,
  type OrderRepository,
  type Period,
} from '../../domain/repositories/order.repository.js';
import { OrderListResult, toOrderResult } from '../dto/order.result.js';
import {
  DRIVER_DIRECTORY,
  type DriverDirectory,
} from '../ports/driver-directory.port.js';

/** 내 배달 목록 조회 유스케이스 (사장님). 배차된 라이더 이름을 붙여 준다. */
@Injectable()
export class ListMyOrdersUseCase {
  constructor(
    @Inject(ORDER_REPOSITORY)
    private readonly orderRepository: OrderRepository,
    @Inject(DRIVER_DIRECTORY)
    private readonly driverDirectory: DriverDirectory,
  ) {}

  async execute(
    customerId: string,
    filter: OrderFilter & { period?: Period },
    page: PageQuery,
  ): Promise<OrderListResult> {
    const { items, total } = await this.orderRepository.findByCustomer(
      customerId,
      filter,
      toPageRequest(page),
    );
    const names = await this.driverDirectory.findNames([
      ...new Set(items.flatMap((order) => order.driverId ?? [])),
    ]);
    return {
      items: items.map((order) => ({
        ...toOrderResult(order),
        driverName: (order.driverId && names.get(order.driverId)) || null,
      })),
      total,
      page: page.page,
      size: page.size,
    };
  }
}
