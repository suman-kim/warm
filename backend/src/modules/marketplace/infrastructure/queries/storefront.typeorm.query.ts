import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import {
  boundingBox,
  distanceKmSql,
} from '../../../../common/infrastructure/persistence/geo-sql.js';
import { StoreOrmEntity } from '../../../store/infrastructure/entities/store.orm-entity.js';
import { MAX_DELIVERY_KM } from '../../domain/entities/storefront.entity.js';
import {
  NearbyStorefront,
  NearbyStorefrontFilter,
  StorefrontQuery,
} from '../../application/ports/storefront.query.js';
import { StorefrontOrmEntity } from '../entities/storefront.orm-entity.js';
import { toStorefront } from '../repositories/storefront.typeorm.repository.js';

/** 가게 목록 조회. 위도·경도 범위로 먼저 좁히고 하버사인 거리로 가게의 배달 거리 안인지 본다. */
@Injectable()
export class StorefrontTypeormQuery implements StorefrontQuery {
  constructor(
    @InjectRepository(StorefrontOrmEntity)
    private readonly storefronts: Repository<StorefrontOrmEntity>,
  ) {}

  async nearby(filter: NearbyStorefrontFilter): Promise<NearbyStorefront[]> {
    const box = boundingBox(filter.latitude, filter.longitude, MAX_DELIVERY_KM);
    const distance = distanceKmSql('s.latitude', 's.longitude');
    const query = this.storefronts
      .createQueryBuilder('f')
      .innerJoin(StoreOrmEntity, 's', 's.id = f.store_id')
      .addSelect('s.name', 'store_name')
      .addSelect(`ROUND((${distance})::numeric, 1)`, 'distance_km')
      .where(`s.status = 'APPROVED'`)
      .andWhere('f.hidden_at IS NULL')
      .andWhere('s.latitude BETWEEN :minLat AND :maxLat', box)
      .andWhere('s.longitude BETWEEN :minLng AND :maxLng', box)
      .andWhere(`${distance} <= f.max_delivery_km`)
      .andWhere(
        `EXISTS (SELECT 1 FROM menu_items m WHERE m.store_id = f.store_id AND m.hidden = false)`,
      )
      .setParameters({ lat: filter.latitude, lng: filter.longitude });
    if (filter.category) {
      query.andWhere('f.category = :category', { category: filter.category });
    }
    const q = filter.q?.trim();
    if (q) {
      query.andWhere(
        new Brackets((where) =>
          where.where('s.name ILIKE :q', { q: `%${q}%` }).orWhere(
            `EXISTS (SELECT 1 FROM menu_items m
                     WHERE m.store_id = f.store_id AND m.hidden = false AND m.name ILIKE :q)`,
          ),
        ),
      );
    }
    const { entities, raw } = await query
      .orderBy('distance_km', 'ASC')
      .getRawAndEntities<{ store_name: string; distance_km: string }>();
    return entities.map((row, index) => ({
      storefront: toStorefront(row),
      storeName: raw[index].store_name,
      distanceKm: Number(raw[index].distance_km),
    }));
  }
}
