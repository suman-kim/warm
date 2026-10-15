import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { PushDevice } from '../../domain/entities/push-device.entity.js';
import { PushDeviceRepository } from '../../domain/repositories/push-device.repository.js';
import { PushDeviceOrmEntity } from '../entities/push-device.orm-entity.js';

/** 푸시 기기 저장소 TypeORM 구현체. */
@Injectable()
export class PushDeviceTypeormRepository implements PushDeviceRepository {
  constructor(
    @InjectRepository(PushDeviceOrmEntity)
    private readonly repository: Repository<PushDeviceOrmEntity>,
  ) {}

  async save(device: PushDevice): Promise<void> {
    // 이미 있는 토큰이면 행(id, created_at)은 두고 소유자·기기 종류·확인 시각만 바꾼다.
    await this.repository
      .createQueryBuilder()
      .insert()
      .values({
        id: device.id,
        userId: device.userId,
        token: device.token,
        platform: device.platform,
        createdAt: device.createdAt,
        updatedAt: device.updatedAt,
      })
      .orUpdate(['user_id', 'platform', 'updated_at'], ['token'])
      .execute();
  }

  async deleteByUserAndToken(userId: string, token: string): Promise<void> {
    await this.repository.delete({ userId, token });
  }

  async deleteByTokens(tokens: string[]): Promise<void> {
    if (tokens.length > 0) {
      await this.repository.delete({ token: In(tokens) });
    }
  }

  async deleteByUser(userId: string): Promise<void> {
    await this.repository.delete({ userId });
  }

  async findTokensByUserIds(userIds: string[]): Promise<string[]> {
    if (userIds.length === 0) {
      return [];
    }
    const rows = await this.repository.find({
      select: { token: true },
      where: { userId: In(userIds) },
    });
    return rows.map((row) => row.token);
  }
}
