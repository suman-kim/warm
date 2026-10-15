import { Inject, Injectable } from '@nestjs/common';
import {
  PageQuery,
  toPageRequest,
} from '../../../../common/application/page.js';
import { NotFoundError } from '../../../../common/domain/domain-error.js';
import {
  USER_REPOSITORY,
  type UserRepository,
} from '../../../user/domain/repositories/user.repository.js';
import { Order } from '../../domain/entities/order.entity.js';
import { OrderStatus } from '../../domain/order-status.js';
import {
  ORDER_REPOSITORY,
  type OrderRepository,
} from '../../domain/repositories/order.repository.js';
import {
  AdminOrderDetailResult,
  AdminOrderPageResult,
  AdminOrderSummaryResult,
} from '../dto/admin-order.result.js';
import { toOrderPaymentResult, toOrderResult } from '../dto/order.result.js';
import {
  ADMIN_ORDER_QUERY,
  type AdminOrderQuery,
  type AdminPaymentFilter,
} from '../ports/admin-order.query.js';
import {
  DRIVER_DIRECTORY,
  type DriverDirectory,
} from '../ports/driver-directory.port.js';
import {
  ORDER_PAYMENTS,
  type OrderPayments,
} from '../ports/order-payments.port.js';
import { toKstPeriod } from '../services/kst-period.js';

/** 주문 현황 유스케이스 (운영자). 한국 날짜 하루의 주문을 상태·결제별로 보고, 주문의 결제를 돌려준다. */
@Injectable()
export class AdminOrdersUseCase {
  constructor(
    @Inject(ADMIN_ORDER_QUERY)
    private readonly orderQuery: AdminOrderQuery,
    @Inject(ORDER_REPOSITORY)
    private readonly orderRepository: OrderRepository,
    @Inject(DRIVER_DIRECTORY)
    private readonly driverDirectory: DriverDirectory,
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepository,
    @Inject(ORDER_PAYMENTS)
    private readonly payments: OrderPayments,
  ) {}

  /** 그날 요청된 주문의 상태별·결제별 건수와 결제·환불 금액. */
  async summary(date: string): Promise<AdminOrderSummaryResult> {
    const { counts, paymentCounts, paidAmount, refundedAmount } =
      await this.orderQuery.summarize(toKstPeriod(date, date));
    return {
      date,
      total: Object.values(counts).reduce((sum, count) => sum + count, 0),
      counts,
      paymentCounts,
      paidAmount,
      refundedAmount,
      revenue: paidAmount - refundedAmount,
    };
  }

  async list(
    date: string,
    filter: { statuses?: OrderStatus[]; payment?: AdminPaymentFilter },
    page: PageQuery,
  ): Promise<AdminOrderPageResult> {
    const { items, total } = await this.orderQuery.find(
      { period: toKstPeriod(date, date), ...filter },
      toPageRequest(page),
    );
    return {
      items: items.map((row) => ({
        id: row.id,
        code: Order.codeOf(row.id, row.requestedAt),
        requestedAt: row.requestedAt,
        vehicleType: row.vehicleType,
        // 동이 없는 주소는 주소의 앞 두 마디(예: 서울 성동구)로 대신한다.
        pickupArea: row.pickupDong ?? shortArea(row.pickupAddress),
        dropoffArea: row.dropoffDong ?? shortArea(row.dropoffAddress),
        distanceKm: row.distanceKm,
        customerName: row.customerName,
        driverName: row.driverName,
        fare: row.fare,
        totalFare: row.totalFare,
        status: row.status,
        paymentStatus: row.paymentStatus,
        paidAmount: row.paidAmount,
        refundedAmount: row.refundedAmount,
      })),
      total,
      page: page.page,
      size: page.size,
    };
  }

  /** 주문 상세: 요금 내역, 진행 단계의 시각, 고객·기사, 결제·환불 기록. */
  async detail(orderId: string): Promise<AdminOrderDetailResult> {
    const order = await this.orderRepository.findById(orderId);
    if (!order) {
      throw new NotFoundError('ORDER_NOT_FOUND', '주문을 찾을 수 없어요.');
    }
    const [driver, history, selectedCard] = await Promise.all([
      order.driverId ? this.driverDirectory.findById(order.driverId) : null,
      this.payments.historyOf(order.id),
      this.payments.cardFor(order.customerId, order.paymentMethodId),
    ]);
    const users = await this.userRepository.findByIds([
      order.customerId,
      ...history.refunds.flatMap((refund) => refund.refundedBy ?? []),
    ]);
    const userById = new Map(users.map((user) => [user.id, user]));
    const customer = userById.get(order.customerId);
    const payment = toOrderPaymentResult(order, history, selectedCard);
    return {
      ...toOrderResult(order),
      customer: {
        id: order.customerId,
        name: customer?.name ?? null,
        phone: customer?.phone ?? null,
      },
      driver: driver && {
        id: driver.id,
        name: driver.name,
        phone: driver.phone,
        vehicleNumber: driver.vehicleNumber,
      },
      payment: {
        status: payment.status,
        card: payment.card,
        paidAmount: payment.paidAmount,
        refundedAmount: payment.refundedAmount,
        refundableAmount: payment.paidAmount - payment.refundedAmount,
        unpaidAmount: payment.unpaidAmount,
        charges: payment.charges,
        refunds: history.refunds.map((refund) => ({
          amount: refund.amount,
          reason: refund.reason,
          refundedByName: refund.refundedBy
            ? (userById.get(refund.refundedBy)?.name ?? null)
            : null,
          automatic: refund.refundedBy === null,
          refundedAt: refund.refundedAt,
        })),
      },
    };
  }

  /** 운영자 환불. 결제한 금액 안에서 일부나 전부를 카드로 돌려주고 고객에게 알린다. */
  async refund(
    actorId: string,
    orderId: string,
    amount: number,
    reason: string,
  ): Promise<AdminOrderDetailResult> {
    const order = await this.orderRepository.findById(orderId);
    if (!order) {
      throw new NotFoundError('ORDER_NOT_FOUND', '주문을 찾을 수 없어요.');
    }
    await this.payments.refund({
      orderId: order.id,
      customerId: order.customerId,
      amount,
      reason: reason.trim(),
      cancellationFee: 0,
      actorId,
      routeLabel: order.routeLabel,
    });
    return this.detail(order.id);
  }
}

function shortArea(address: string): string {
  return address.trim().split(/\s+/).slice(0, 2).join(' ');
}
