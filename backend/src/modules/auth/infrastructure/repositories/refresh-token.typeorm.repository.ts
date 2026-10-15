import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { RefreshToken } from '../../domain/entities/refresh-token.entity.js';
import { RefreshTokenRepository } from '../../domain/repositories/refresh-token.repository.js';
import { RefreshTokenOrmEntity } from '../entities/refresh-token.orm-entity.js';

/** 리프레시 토큰 저장소 TypeORM 구현체. */
@Injectable()
export class RefreshTokenTypeormRepository implements RefreshTokenRepository {
  constructor(
    @InjectRepository(RefreshTokenOrmEntity)
    private readonly repository: Repository<RefreshTokenOrmEntity>,
  ) {}

  async save(token: RefreshToken): Promise<void> {
    await this.repository.insert({
      id: token.id,
      userId: token.userId,
      tokenHash: token.tokenHash,
      expiresAt: token.expiresAt,
      revokedAt: token.revokedAt,
      createdAt: token.createdAt,
    });
  }

  async findByHash(tokenHash: string): Promise<RefreshToken | null> {
    const row = await this.repository.findOne({ where: { tokenHash } });
    return row
      ? new RefreshToken(
          row.id,
          row.userId,
          row.tokenHash,
          row.expiresAt,
          row.revokedAt,
          row.createdAt,
        )
      : null;
  }

  async revokeByHash(tokenHash: string, now: Date): Promise<boolean> {
    const result = await this.repository.update(
      { tokenHash, revokedAt: IsNull() },
      { revokedAt: now },
    );
    return (result.affected ?? 0) > 0;
  }

  async revokeAllByUser(userId: string, now: Date): Promise<void> {
    await this.repository.update(
      { userId, revokedAt: IsNull() },
      { revokedAt: now },
    );
  }
}
