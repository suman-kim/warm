import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { persistAggregate } from '../../../../common/infrastructure/persistence/persist-aggregate.js';
import {
  FoodCategory,
  Storefront,
} from '../../domain/entities/storefront.entity.js';
import { StorefrontRepository } from '../../domain/repositories/marketplace.repositories.js';
import { StorefrontOrmEntity } from '../entities/storefront.orm-entity.js';

@Injectable()
export class StorefrontTypeormRepository implements StorefrontRepository {
  constructor(
    @InjectRepository(StorefrontOrmEntity)
    private readonly storefronts: Repository<StorefrontOrmEntity>,
  ) {}

  async findByStoreId(storeId: string): Promise<Storefront | null> {
    const row = await this.storefronts.findOne({ where: { id: storeId } });
    return row ? toStorefront(row) : null;
  }

  async findByStoreIds(storeIds: string[]): Promise<Storefront[]> {
    if (storeIds.length === 0) return [];
    const rows = await this.storefronts.find({ where: { id: In(storeIds) } });
    return rows.map(toStorefront);
  }

  save(storefront: Storefront): Promise<void> {
    const state = storefront.snapshot();
    return persistAggregate(this.storefronts, storefront, {
      id: state.storeId,
      category: state.category,
      description: state.description,
      originNotice: state.originNotice,
      minOrderAmount: state.minOrderAmount,
      maxDeliveryKm: state.maxDeliveryKm,
      deliveryTipRules: state.deliveryTipRules,
      distanceTipRules: state.distanceTipRules,
      businessHours: state.businessHours,
      holidays: state.holidays,
      logoKey: state.logoKey,
      open: state.open,
      pausedUntil: state.pausedUntil,
      hiddenAt: state.hiddenAt,
      hiddenReason: state.hiddenReason,
      version: storefront.version,
      createdAt: state.createdAt,
      updatedAt: state.updatedAt,
    });
  }
}

export function toStorefront(row: StorefrontOrmEntity): Storefront {
  return Storefront.restore(
    {
      storeId: row.id,
      category: row.category as FoodCategory,
      description: row.description,
      originNotice: row.originNotice,
      minOrderAmount: row.minOrderAmount,
      maxDeliveryKm: row.maxDeliveryKm,
      deliveryTipRules: row.deliveryTipRules,
      distanceTipRules: row.distanceTipRules,
      businessHours: row.businessHours,
      holidays: row.holidays,
      logoKey: row.logoKey,
      open: row.open,
      pausedUntil: row.pausedUntil,
      hiddenAt: row.hiddenAt,
      hiddenReason: row.hiddenReason,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    },
    row.version,
  );
}
