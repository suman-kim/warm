import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import { Paged, PageRequest } from '../../../../common/domain/pagination.js';
import { Notification } from '../../domain/entities/notification.entity.js';
import { PushType } from '../../domain/push-message.js';
import {
  NotificationRepository,
  NotificationSettingRepository,
} from '../../domain/repositories/notification.repositories.js';
import { NotificationOrmEntity } from '../entities/notification.orm-entity.js';
import { NotificationSettingOrmEntity } from '../entities/notification-setting.orm-entity.js';

/** 알림함 저장소 TypeORM 구현체. */
@Injectable()
export class NotificationTypeormRepository implements NotificationRepository {
  constructor(
    @InjectRepository(NotificationOrmEntity)
    private readonly repository: Repository<NotificationOrmEntity>,
  ) {}

  async saveAll(notifications: Notification[]): Promise<void> {
    if (notifications.length > 0) {
      await this.repository.insert(
        notifications.map((notification) => ({ ...notification })),
      );
    }
  }

  async findByUser(
    userId: string,
    page: PageRequest,
  ): Promise<Paged<Notification>> {
    const [rows, total] = await this.repository.findAndCount({
      where: { userId },
      order: { createdAt: 'DESC' },
      skip: page.offset,
      take: page.limit,
    });
    return {
      items: rows.map(
        (row) =>
          new Notification(
            row.id,
            row.userId,
            row.type as PushType,
            row.title,
            row.body,
            row.data,
            row.readAt,
            row.createdAt,
          ),
      ),
      total,
    };
  }

  countUnread(userId: string): Promise<number> {
    return this.repository.count({ where: { userId, readAt: IsNull() } });
  }

  async markRead(userId: string, id: string, now: Date): Promise<void> {
    await this.repository.update(
      { id, userId, readAt: IsNull() },
      { readAt: now },
    );
  }

  async markAllRead(userId: string, now: Date): Promise<void> {
    await this.repository.update({ userId, readAt: IsNull() }, { readAt: now });
  }

  async deleteByUser(userId: string): Promise<void> {
    await this.repository.delete({ userId });
  }
}

/** 알림 설정 저장소 TypeORM 구현체. */
@Injectable()
export class NotificationSettingTypeormRepository implements NotificationSettingRepository {
  constructor(
    @InjectRepository(NotificationSettingOrmEntity)
    private readonly repository: Repository<NotificationSettingOrmEntity>,
  ) {}

  async isPushEnabled(userId: string): Promise<boolean> {
    const row = await this.repository.findOne({ where: { userId } });
    return row?.pushEnabled ?? true;
  }

  async findPushDisabled(userIds: string[]): Promise<Set<string>> {
    if (userIds.length === 0) {
      return new Set();
    }
    const rows = await this.repository.find({
      select: { userId: true },
      where: { userId: In(userIds), pushEnabled: false },
    });
    return new Set(rows.map((row) => row.userId));
  }

  async save(userId: string, pushEnabled: boolean): Promise<void> {
    await this.repository.upsert({ userId, pushEnabled }, ['userId']);
  }

  async deleteByUser(userId: string): Promise<void> {
    await this.repository.delete({ userId });
  }
}
