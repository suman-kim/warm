import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';
import { ConsumerAddress } from '../../domain/entities/consumer-address.entity.js';
import { ConsumerAddressRepository } from '../../domain/repositories/marketplace.repositories.js';
import { ConsumerAddressOrmEntity } from '../entities/consumer-address.orm-entity.js';

@Injectable()
export class ConsumerAddressTypeormRepository implements ConsumerAddressRepository {
  constructor(
    @InjectRepository(ConsumerAddressOrmEntity)
    private readonly addresses: Repository<ConsumerAddressOrmEntity>,
  ) {}

  async findByUser(userId: string): Promise<ConsumerAddress[]> {
    const rows = await this.addresses.find({
      where: { userId },
      order: { isDefault: 'DESC', createdAt: 'DESC' },
    });
    return rows.map((row) => ({ ...row }));
  }

  async findById(id: string): Promise<ConsumerAddress | null> {
    const row = await this.addresses.findOne({ where: { id } });
    return row ? { ...row } : null;
  }

  async save(address: ConsumerAddress): Promise<void> {
    await this.addresses.manager.transaction(async (manager) => {
      const repository = manager.getRepository(ConsumerAddressOrmEntity);
      if (address.isDefault) {
        await repository.update(
          { userId: address.userId, id: Not(address.id), isDefault: true },
          { isDefault: false },
        );
      }
      await repository.save(
        Object.assign(new ConsumerAddressOrmEntity(), address),
      );
    });
  }

  async delete(id: string): Promise<void> {
    await this.addresses.delete({ id });
  }

  async deleteAllByUser(userId: string): Promise<void> {
    await this.addresses.delete({ userId });
  }
}
