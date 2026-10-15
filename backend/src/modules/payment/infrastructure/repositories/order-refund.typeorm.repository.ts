import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { OrderRefund } from '../../domain/entities/order-refund.entity.js';
import { OrderRefundRepository } from '../../domain/repositories/payment.repositories.js';
import { OrderRefundOrmEntity } from '../entities/order-refund.orm-entity.js';

/** 주문의 환불 기록 저장소 TypeORM 구현체. */
@Injectable()
export class OrderRefundTypeormRepository implements OrderRefundRepository {
  constructor(
    @InjectRepository(OrderRefundOrmEntity)
    private readonly repository: Repository<OrderRefundOrmEntity>,
  ) {}

  async save(refund: OrderRefund): Promise<void> {
    await this.repository.insert({ ...refund });
  }

  async findByOrders(orderIds: string[]): Promise<OrderRefund[]> {
    if (orderIds.length === 0) {
      return [];
    }
    const rows = await this.repository.find({
      where: { orderId: In(orderIds) },
      order: { createdAt: 'ASC', id: 'ASC' },
    });
    return rows.map(
      (row) =>
        new OrderRefund(
          row.id,
          row.orderId,
          row.customerId,
          row.amount,
          row.reason,
          row.refundedBy,
          row.createdAt,
        ),
    );
  }
}
