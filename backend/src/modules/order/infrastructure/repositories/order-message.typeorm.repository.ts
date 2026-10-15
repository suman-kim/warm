import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThan, Repository } from 'typeorm';
import { OrderMessage } from '../../domain/entities/order-message.entity.js';
import { OrderMessageRepository } from '../../domain/repositories/order-message.repository.js';
import { OrderMessageOrmEntity } from '../entities/order-message.orm-entity.js';

/** 주문 메시지 저장소 TypeORM 구현체. */
@Injectable()
export class OrderMessageTypeormRepository implements OrderMessageRepository {
  constructor(
    @InjectRepository(OrderMessageOrmEntity)
    private readonly repository: Repository<OrderMessageOrmEntity>,
  ) {}

  async save(message: OrderMessage): Promise<void> {
    await this.repository.insert({ ...message });
  }

  async findByOrder(
    orderId: string,
    options: { after?: Date; limit: number },
  ): Promise<OrderMessage[]> {
    const rows = await this.repository.find({
      where: {
        orderId,
        ...(options.after ? { createdAt: MoreThan(options.after) } : {}),
      },
      order: { createdAt: 'ASC' },
      take: options.limit,
    });
    return rows.map(
      (row) =>
        new OrderMessage(
          row.id,
          row.orderId,
          row.senderUserId,
          row.text,
          row.createdAt,
        ),
    );
  }
}
