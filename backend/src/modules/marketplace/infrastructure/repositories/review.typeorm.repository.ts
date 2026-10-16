import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ConflictError } from '../../../../common/domain/domain-error.js';
import { Paged, PageRequest } from '../../../../common/domain/pagination.js';
import { isUniqueViolation } from '../../../../common/infrastructure/persistence/persist-aggregate.js';
import { Review } from '../../domain/entities/review.entity.js';
import { ReviewRepository } from '../../domain/repositories/marketplace.repositories.js';
import { ReviewOrmEntity } from '../entities/review.orm-entity.js';

@Injectable()
export class ReviewTypeormRepository implements ReviewRepository {
  constructor(
    @InjectRepository(ReviewOrmEntity)
    private readonly reviews: Repository<ReviewOrmEntity>,
  ) {}

  async insert(review: Review): Promise<void> {
    try {
      await this.reviews.insert({ ...review });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictError(
          'ALREADY_REVIEWED',
          '이미 리뷰를 쓴 주문이에요.',
        );
      }
      throw error;
    }
  }

  async findByFoodOrder(foodOrderId: string): Promise<Review | null> {
    const row = await this.reviews.findOne({ where: { foodOrderId } });
    return row ? { ...row } : null;
  }

  async reviewedOrderIds(foodOrderIds: string[]): Promise<Set<string>> {
    if (foodOrderIds.length === 0) return new Set();
    const rows = await this.reviews.find({
      select: { foodOrderId: true },
      where: { foodOrderId: In(foodOrderIds) },
    });
    return new Set(rows.map((row) => row.foodOrderId));
  }

  async findByStore(
    storeId: string,
    page: PageRequest,
  ): Promise<Paged<Review>> {
    const [rows, total] = await this.reviews.findAndCount({
      where: { storeId },
      order: { createdAt: 'DESC', id: 'DESC' },
      skip: page.offset,
      take: page.limit,
    });
    return { items: rows.map((row) => ({ ...row })), total };
  }

  async summaries(
    storeIds: string[],
  ): Promise<Map<string, { average: number; count: number }>> {
    if (storeIds.length === 0) return new Map();
    const rows = await this.reviews
      .createQueryBuilder('r')
      .select('r.store_id', 'storeId')
      .addSelect('ROUND(AVG(r.rating)::numeric, 1)', 'average')
      .addSelect('COUNT(*)', 'count')
      .where('r.store_id IN (:...storeIds)', { storeIds })
      .groupBy('r.store_id')
      .getRawMany<{ storeId: string; average: string; count: string }>();
    return new Map(
      rows.map((row) => [
        row.storeId,
        { average: Number(row.average), count: Number(row.count) },
      ]),
    );
  }
}
