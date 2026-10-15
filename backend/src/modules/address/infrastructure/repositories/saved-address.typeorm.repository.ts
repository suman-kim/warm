import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  SavedAddress,
  SavedAddressRepository,
} from '../../domain/saved-address.js';
import { SavedAddressOrmEntity } from '../entities/saved-address.orm-entity.js';

/** 자주 쓰는 주소 저장소 TypeORM 구현체. */
@Injectable()
export class SavedAddressTypeormRepository implements SavedAddressRepository {
  constructor(
    @InjectRepository(SavedAddressOrmEntity)
    private readonly repository: Repository<SavedAddressOrmEntity>,
  ) {}

  async save(address: SavedAddress): Promise<void> {
    await this.repository.save({ ...address });
  }

  async findByUser(userId: string): Promise<SavedAddress[]> {
    const rows = await this.repository.find({
      where: { userId },
      order: { createdAt: 'ASC' },
    });
    return rows.map(toDomain);
  }

  async findOne(userId: string, id: string): Promise<SavedAddress | null> {
    const row = await this.repository.findOne({ where: { userId, id } });
    return row ? toDomain(row) : null;
  }

  countByUser(userId: string): Promise<number> {
    return this.repository.count({ where: { userId } });
  }

  async delete(userId: string, id: string): Promise<void> {
    await this.repository.delete({ userId, id });
  }

  async deleteByUser(userId: string): Promise<void> {
    await this.repository.delete({ userId });
  }
}

function toDomain(row: SavedAddressOrmEntity): SavedAddress {
  return new SavedAddress(
    row.id,
    row.userId,
    row.label,
    row.address,
    row.detailAddress,
    row.sigungu,
    row.dong,
    row.latitude,
    row.longitude,
    row.createdAt,
  );
}
