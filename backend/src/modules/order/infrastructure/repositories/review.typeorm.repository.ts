import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConflictError } from '../../../../common/domain/domain-error.js';
import { isUniqueViolation } from '../../../../common/infrastructure/persistence/persist-aggregate.js';
import { Review, ReviewTag } from '../../domain/entities/review.entity.js';
import {
  DriverRating,
  ReviewRepository,
} from '../../domain/repositories/review.repository.js';
import { ReviewOrmEntity } from '../entities/review.orm-entity.js';

/** 평가 저장소 TypeORM 구현체. */
@Injectable()
export class ReviewTypeormRepository implements ReviewRepository {
  constructor(
    @InjectRepository(ReviewOrmEntity)
    private readonly repository: Repository<ReviewOrmEntity>,
  ) {}

  async save(review: Review): Promise<void> {
    try {
      await this.repository.insert({ ...review });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictError(
          'REVIEW_ALREADY_WRITTEN',
          '이미 평가를 남긴 주문이에요.',
        );
      }
      throw error;
    }
  }

  async findByOrderId(orderId: string): Promise<Review | null> {
    const row = await this.repository.findOne({ where: { orderId } });
    return row
      ? new Review(
          row.id,
          row.orderId,
          row.customerId,
          row.driverId,
          row.rating,
          row.tags as ReviewTag[],
          row.comment,
          row.createdAt,
        )
      : null;
  }

  async ratingOf(driverId: string): Promise<DriverRating> {
    const row = await this.repository
      .createQueryBuilder('r')
      .select('AVG(r.rating)', 'average')
      .addSelect('COUNT(*)', 'count')
      .where('r.driver_id = :driverId', { driverId })
      .getRawOne<{ average: string | null; count: string }>();
    const count = Number(row?.count ?? 0);
    return {
      average: count > 0 ? Math.round(Number(row?.average) * 10) / 10 : null,
      count,
    };
  }
}
