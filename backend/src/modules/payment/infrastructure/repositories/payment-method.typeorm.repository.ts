import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { PaymentMethod } from '../../domain/entities/payment-method.entity.js';
import { PaymentMethodRepository } from '../../domain/repositories/payment.repositories.js';
import { PaymentMethodOrmEntity } from '../entities/payment-method.orm-entity.js';

/** 등록한 카드 저장소 TypeORM 구현체. */
@Injectable()
export class PaymentMethodTypeormRepository implements PaymentMethodRepository {
  constructor(
    @InjectRepository(PaymentMethodOrmEntity)
    private readonly repository: Repository<PaymentMethodOrmEntity>,
  ) {}

  async save(method: PaymentMethod): Promise<void> {
    await this.repository.save({
      id: method.id,
      userId: method.userId,
      billingKey: method.billingKey,
      cardBrand: method.cardBrand,
      cardLast4: method.cardLast4,
      cardType: method.cardType,
      isDefault: method.isDefault,
      createdAt: method.createdAt,
      removedAt: method.removedAt,
    });
  }

  async findById(id: string): Promise<PaymentMethod | null> {
    const row = await this.repository.findOne({ where: { id } });
    return row ? toDomain(row) : null;
  }

  async findUsableByUser(userId: string): Promise<PaymentMethod[]> {
    const rows = await this.repository.find({
      where: { userId, removedAt: IsNull() },
      order: { createdAt: 'ASC', id: 'ASC' },
    });
    return rows.map(toDomain);
  }
}

function toDomain(row: PaymentMethodOrmEntity): PaymentMethod {
  return new PaymentMethod(
    row.id,
    row.userId,
    row.billingKey,
    row.cardBrand,
    row.cardLast4,
    row.cardType,
    row.isDefault,
    row.createdAt,
    row.removedAt,
  );
}
