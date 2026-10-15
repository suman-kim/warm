import { Inject, Injectable } from '@nestjs/common';
import {
  PageQuery,
  toPageRequest,
} from '../../../../common/application/page.js';
import {
  ORDER_REPOSITORY,
  type OrderFilter,
  type OrderRepository,
} from '../../domain/repositories/order.repository.js';
import {
  OrderListResult,
  toOrderPaymentResult,
  toOrderResult,
} from '../dto/order.result.js';
import {
  DRIVER_DIRECTORY,
  type DriverDirectory,
} from '../ports/driver-directory.port.js';
import {
  NO_PAYMENT_HISTORY,
  ORDER_PAYMENTS,
  type OrderPayments,
} from '../ports/order-payments.port.js';

/** 내 주문 목록 조회 유스케이스 (고객). 배차된 기사 이름과 결제 정보(취소 수수료·환불)를 붙여 준다. */
@Injectable()
export class ListMyOrdersUseCase {
  constructor(
    @Inject(ORDER_REPOSITORY)
    private readonly orderRepository: OrderRepository,
    @Inject(DRIVER_DIRECTORY)
    private readonly driverDirectory: DriverDirectory,
    @Inject(ORDER_PAYMENTS)
    private readonly payments: OrderPayments,
  ) {}

  async execute(
    customerId: string,
    filter: OrderFilter,
    page: PageQuery,
  ): Promise<OrderListResult> {
    const { items, total } = await this.orderRepository.findByCustomer(
      customerId,
      filter,
      toPageRequest(page),
    );
    const driverIds = [
      ...new Set(items.flatMap((order) => order.driverId ?? [])),
    ];
    const [names, histories] = await Promise.all([
      this.driverDirectory.findNames(driverIds),
      this.payments.historiesOf(items.map((order) => order.id)),
    ]);
    return {
      items: items.map((order) => ({
        ...toOrderResult(order),
        driverName: (order.driverId && names.get(order.driverId)) || null,
        payment: toOrderPaymentResult(
          order,
          histories.get(order.id) ?? NO_PAYMENT_HISTORY,
        ),
      })),
      total,
      page: page.page,
      size: page.size,
    };
  }
}
