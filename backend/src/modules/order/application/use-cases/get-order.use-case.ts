import { Inject, Injectable } from '@nestjs/common';
import { AuthenticatedUser } from '../../../../common/application/authenticated-user.js';
import { NotFoundError } from '../../../../common/domain/domain-error.js';
import { UserRole } from '../../../../common/domain/user-role.js';
import {
  REVIEW_REPOSITORY,
  type ReviewRepository,
} from '../../domain/repositories/review.repository.js';
import {
  OrderDetailResult,
  ReceiptResult,
  toOrderDetailResult,
  toOrderPaymentResult,
  toReceiptResult,
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
import { OrderAccess } from '../services/order-access.js';

/**
 * 주문 상세 조회 유스케이스. 배차된 기사(평점 포함)와 남긴 평가, 결제 정보를 함께 준다.
 * 결제 정보(카드)는 고객과 운영자에게만 — 기사에게는 null이다.
 */
@Injectable()
export class GetOrderUseCase {
  constructor(
    private readonly orderAccess: OrderAccess,
    @Inject(DRIVER_DIRECTORY)
    private readonly driverDirectory: DriverDirectory,
    @Inject(REVIEW_REPOSITORY)
    private readonly reviewRepository: ReviewRepository,
    @Inject(ORDER_PAYMENTS)
    private readonly payments: OrderPayments,
  ) {}

  async execute(
    requester: AuthenticatedUser,
    orderId: string,
  ): Promise<OrderDetailResult> {
    const { order } = await this.orderAccess.load(requester, orderId);
    const driverId = order.driverId;
    const showPayment = requester.role !== UserRole.DRIVER;
    const [driver, rating, review, history, selectedCard] = await Promise.all([
      driverId ? this.driverDirectory.findById(driverId) : null,
      driverId
        ? this.reviewRepository.ratingOf(driverId)
        : { average: null, count: 0 },
      this.reviewRepository.findByOrderId(order.id),
      showPayment ? this.payments.historyOf(order.id) : NO_PAYMENT_HISTORY,
      showPayment
        ? this.payments.cardFor(order.customerId, order.paymentMethodId)
        : null,
    ]);
    return toOrderDetailResult(
      order,
      driver,
      rating,
      review,
      showPayment ? toOrderPaymentResult(order, history, selectedCard) : null,
    );
  }

  /** 영수증 (고객 본인). 결제한 적이 없으면 404. */
  async receipt(
    requester: AuthenticatedUser,
    orderId: string,
  ): Promise<ReceiptResult> {
    const { order } = await this.orderAccess.load(requester, orderId);
    const receipt = toReceiptResult(
      order,
      await this.payments.historyOf(order.id),
    );
    if (requester.role === UserRole.DRIVER || receipt.paidAmount === 0) {
      throw new NotFoundError('RECEIPT_NOT_FOUND', '결제한 내역이 없어요.');
    }
    return receipt;
  }
}
