import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { OrderCharge } from '../../domain/entities/order-charge.entity.js';
import { OrderChargeRepository } from '../../domain/repositories/payment.repositories.js';
import { OrderChargeOrmEntity } from '../entities/order-charge.orm-entity.js';

/** 주문의 카드 결제 저장소 TypeORM 구현체. */
@Injectable()
export class OrderChargeTypeormRepository implements OrderChargeRepository {
  constructor(
    @InjectRepository(OrderChargeOrmEntity)
    private readonly repository: Repository<OrderChargeOrmEntity>,
  ) {}

  async save(charge: OrderCharge): Promise<void> {
    const state = charge.snapshot();
    await this.repository.save({
      id: state.id,
      orderId: state.orderId,
      customerId: state.customerId,
      kind: state.kind,
      amount: state.amount,
      status: state.status,
      paymentMethodId: state.card.paymentMethodId,
      cardBrand: state.card.brand,
      cardLast4: state.card.last4,
      cardType: state.card.type,
      paymentKey: state.paymentKey,
      approvalNumber: state.approvalNumber,
      approvedAt: state.approvedAt,
      failureCode: state.failureCode,
      failedAt: state.failedAt,
      cancelledAmount: state.cancelledAmount,
      cancelledAt: state.cancelledAt,
      createdAt: state.createdAt,
    });
  }

  findByOrder(orderId: string): Promise<OrderCharge[]> {
    return this.findByOrders([orderId]);
  }

  async findByOrders(orderIds: string[]): Promise<OrderCharge[]> {
    if (orderIds.length === 0) {
      return [];
    }
    const rows = await this.repository.find({
      where: { orderId: In(orderIds) },
      order: { createdAt: 'ASC', id: 'ASC' },
    });
    return rows.map((row) =>
      OrderCharge.restore({
        id: row.id,
        orderId: row.orderId,
        customerId: row.customerId,
        kind: row.kind,
        amount: row.amount,
        status: row.status,
        card: {
          paymentMethodId: row.paymentMethodId,
          brand: row.cardBrand,
          last4: row.cardLast4,
          type: row.cardType,
        },
        paymentKey: row.paymentKey,
        approvalNumber: row.approvalNumber,
        approvedAt: row.approvedAt,
        failureCode: row.failureCode,
        failedAt: row.failedAt,
        cancelledAmount: row.cancelledAmount,
        cancelledAt: row.cancelledAt,
        createdAt: row.createdAt,
      }),
    );
  }
}
