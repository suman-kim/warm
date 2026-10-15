import { randomUUID } from 'node:crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  DOMAIN_EVENT_PUBLISHER,
  type DomainEventPublisher,
} from '../../../../common/application/domain-event-publisher.port.js';
import { ConflictError } from '../../../../common/domain/domain-error.js';
import {
  ChargeKind,
  OrderCharge,
} from '../../domain/entities/order-charge.entity.js';
import { OrderRefund } from '../../domain/entities/order-refund.entity.js';
import { PaymentMethod } from '../../domain/entities/payment-method.entity.js';
import {
  OrderAdditionalChargeFailedEvent,
  OrderChargePaidEvent,
  OrderRefundedEvent,
} from '../../domain/events/payment.events.js';
import { PaymentFailureCode } from '../../domain/payment-failure.js';
import {
  ORDER_CHARGE_REPOSITORY,
  ORDER_REFUND_REPOSITORY,
  PAYMENT_METHOD_REPOSITORY,
  type OrderChargeRepository,
  type OrderRefundRepository,
  type PaymentMethodRepository,
} from '../../domain/repositories/payment.repositories.js';
import {
  PAYMENT_GATEWAY,
  type PaymentGateway,
} from '../ports/payment-gateway.port.js';
import { customerKeyOf } from '../use-cases/payment-methods.use-case.js';

export interface ChargeOrderCommand {
  orderId: string;
  customerId: string;
  /** 고객이 주문에 고른 카드. 그사이 지웠으면 기본 카드로 결제한다. */
  paymentMethodId: string | null;
  kind: ChargeKind;
  amount: number;
  /** 카드 명세서에 보일 이름 (예: MOVO 퀵 성수동→역삼동) */
  orderName: string;
  /** 알림에 적을 구간 (예: 성수동 → 역삼동) */
  routeLabel: string;
}

/** 주문의 결제와 환불 기록 */
export interface OrderPaymentHistory {
  charges: OrderCharge[];
  refunds: OrderRefund[];
}

export type ChargeOrderOutcome =
  | { ok: true; charge: OrderCharge }
  | { ok: false; failureCode: PaymentFailureCode; charge: OrderCharge | null };

/**
 * 주문의 카드 결제를 맡는 서비스. 주문 모듈이 포트(ORDER_PAYMENTS)를 거쳐 부른다.
 * 서버가 고객의 빌링키로 결제한다 — 고객이 앱을 보고 있지 않아도 된다.
 */
@Injectable()
export class OrderPaymentService {
  private readonly logger = new Logger(OrderPaymentService.name);

  constructor(
    @Inject(PAYMENT_METHOD_REPOSITORY)
    private readonly methods: PaymentMethodRepository,
    @Inject(ORDER_CHARGE_REPOSITORY)
    private readonly charges: OrderChargeRepository,
    @Inject(ORDER_REFUND_REPOSITORY)
    private readonly refunds: OrderRefundRepository,
    @Inject(PAYMENT_GATEWAY)
    private readonly gateway: PaymentGateway,
    @Inject(DOMAIN_EVENT_PUBLISHER)
    private readonly eventPublisher: DomainEventPublisher,
  ) {}

  /** 고객이 이 주문에 쓸 카드. [paymentMethodId]가 없거나 쓸 수 없으면 기본 카드. 카드가 없으면 null. */
  async cardFor(
    customerId: string,
    paymentMethodId?: string | null,
  ): Promise<PaymentMethod | null> {
    if (paymentMethodId) {
      const chosen = await this.methods.findById(paymentMethodId);
      if (chosen && chosen.userId === customerId && chosen.isUsable) {
        return chosen;
      }
    }
    const usable = await this.methods.findUsableByUser(customerId);
    return usable.find((method) => method.isDefault) ?? usable[0] ?? null;
  }

  /** 고객이 고른 카드가 고객의 쓸 수 있는 카드인지. */
  async isUsableCard(
    customerId: string,
    paymentMethodId: string,
  ): Promise<boolean> {
    const method = await this.methods.findById(paymentMethodId);
    return !!method && method.userId === customerId && method.isUsable;
  }

  async charge(command: ChargeOrderCommand): Promise<ChargeOrderOutcome> {
    const method = await this.cardFor(
      command.customerId,
      command.paymentMethodId,
    );
    if (!method) {
      return {
        ok: false,
        failureCode: PaymentFailureCode.NO_CARD,
        charge: null,
      };
    }
    const card = {
      paymentMethodId: method.id,
      brand: method.cardBrand,
      last4: method.cardLast4,
      type: method.cardType,
    };
    const id = randomUUID();
    const outcome = await this.gateway
      .charge({
        billingKey: method.billingKey,
        customerKey: customerKeyOf(command.customerId),
        chargeId: id,
        amount: command.amount,
        orderName: command.orderName,
      })
      .catch((error: unknown) => {
        this.logger.error(`결제 요청 실패 (${command.orderId})`, error);
        return {
          ok: false as const,
          failureCode: PaymentFailureCode.UNKNOWN,
          message: '결제 요청 실패',
        };
      });
    const base = {
      id,
      orderId: command.orderId,
      customerId: command.customerId,
      kind: command.kind,
      amount: command.amount,
      card,
    };
    if (!outcome.ok) {
      const charge = OrderCharge.failed({
        ...base,
        failureCode: outcome.failureCode,
        now: new Date(),
      });
      await this.charges.save(charge);
      if (command.kind === ChargeKind.ADDITIONAL) {
        await this.eventPublisher.publishAll([
          new OrderAdditionalChargeFailedEvent(
            command.orderId,
            new Date(),
            command.customerId,
            command.amount,
            outcome.failureCode,
            command.routeLabel,
          ),
        ]);
      }
      return { ok: false, failureCode: outcome.failureCode, charge };
    }
    const charge = OrderCharge.paid({
      ...base,
      paymentKey: outcome.paymentKey,
      approvalNumber: outcome.approvalNumber,
      approvedAt: outcome.approvedAt,
    });
    await this.charges.save(charge);
    await this.eventPublisher.publishAll([
      new OrderChargePaidEvent(
        command.orderId,
        outcome.approvedAt,
        command.customerId,
        command.kind,
        command.amount,
        method.label,
        command.routeLabel,
      ),
    ]);
    return { ok: true, charge };
  }

  /**
   * 결제한 금액에서 [amount]를 돌려준다. 나중에 한 결제(추가 결제)부터 취소한다.
   * [cancellationFee]는 알림에 적을 취소 수수료, [actorId]는 돌려준 운영자다(자동 환불이면 null).
   */
  async refund(input: {
    orderId: string;
    customerId: string;
    amount: number;
    reason: string;
    cancellationFee: number;
    actorId: string | null;
    routeLabel: string;
  }): Promise<void> {
    if (input.amount <= 0) {
      return;
    }
    const charges = (await this.charges.findByOrder(input.orderId))
      .filter((charge) => charge.isPaid)
      .reverse();
    const refundable = charges.reduce((sum, c) => sum + c.remainingAmount, 0);
    if (input.amount > refundable) {
      throw new ConflictError(
        'REFUND_EXCEEDS_PAID',
        `돌려줄 수 있는 금액은 ${refundable.toLocaleString('ko-KR')}원이에요.`,
      );
    }
    const now = new Date();
    let left = input.amount;
    for (const charge of charges) {
      const part = Math.min(left, charge.remainingAmount);
      if (part === 0) {
        continue;
      }
      await this.gateway.cancel({
        paymentKey: charge.paymentKey!,
        amount: part,
        reason: input.reason,
      });
      charge.cancel(part, now);
      await this.charges.save(charge);
      left -= part;
      if (left === 0) {
        break;
      }
    }
    await this.refunds.save(
      new OrderRefund(
        randomUUID(),
        input.orderId,
        input.customerId,
        input.amount,
        input.reason,
        input.actorId,
        now,
      ),
    );
    await this.eventPublisher.publishAll([
      new OrderRefundedEvent(
        input.orderId,
        now,
        input.customerId,
        input.amount,
        input.cancellationFee,
        input.reason,
        input.routeLabel,
      ),
    ]);
  }

  /** 여러 주문의 결제와 환불 기록을 주문 ID별로. */
  async historiesOf(
    orderIds: string[],
  ): Promise<Map<string, OrderPaymentHistory>> {
    const [charges, refunds] = await Promise.all([
      this.charges.findByOrders(orderIds),
      this.refunds.findByOrders(orderIds),
    ]);
    const byOrder = new Map<string, OrderPaymentHistory>(
      orderIds.map((id) => [id, { charges: [], refunds: [] }]),
    );
    for (const charge of charges) {
      byOrder.get(charge.snapshot().orderId)?.charges.push(charge);
    }
    for (const refund of refunds) {
      byOrder.get(refund.orderId)?.refunds.push(refund);
    }
    return byOrder;
  }
}
