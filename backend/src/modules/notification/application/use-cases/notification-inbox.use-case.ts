import { Inject, Injectable } from '@nestjs/common';
import {
  PageQuery,
  toPageRequest,
} from '../../../../common/application/page.js';
import {
  NOTIFICATION_REPOSITORY,
  NOTIFICATION_SETTING_REPOSITORY,
  type NotificationRepository,
  type NotificationSettingRepository,
} from '../../domain/repositories/notification.repositories.js';
import {
  NotificationPageResult,
  NotificationSettingResult,
  UnreadCountResult,
} from '../dto/notification.result.js';

/** 알림함과 알림 설정 유스케이스. */
@Injectable()
export class NotificationInboxUseCase {
  constructor(
    @Inject(NOTIFICATION_REPOSITORY)
    private readonly notificationRepository: NotificationRepository,
    @Inject(NOTIFICATION_SETTING_REPOSITORY)
    private readonly settingRepository: NotificationSettingRepository,
  ) {}

  async list(userId: string, page: PageQuery): Promise<NotificationPageResult> {
    const [{ items, total }, unreadCount] = await Promise.all([
      this.notificationRepository.findByUser(userId, toPageRequest(page)),
      this.notificationRepository.countUnread(userId),
    ]);
    return {
      items: items.map((notification) => ({
        id: notification.id,
        type: notification.type,
        title: notification.title,
        body: notification.body,
        data: notification.data,
        readAt: notification.readAt,
        createdAt: notification.createdAt,
      })),
      total,
      page: page.page,
      size: page.size,
      unreadCount,
    };
  }

  async unreadCount(userId: string): Promise<UnreadCountResult> {
    return {
      unreadCount: await this.notificationRepository.countUnread(userId),
    };
  }

  markRead(userId: string, notificationId: string): Promise<void> {
    return this.notificationRepository.markRead(
      userId,
      notificationId,
      new Date(),
    );
  }

  markAllRead(userId: string): Promise<void> {
    return this.notificationRepository.markAllRead(userId, new Date());
  }

  async setting(userId: string): Promise<NotificationSettingResult> {
    return { pushEnabled: await this.settingRepository.isPushEnabled(userId) };
  }

  async updateSetting(
    userId: string,
    pushEnabled: boolean,
  ): Promise<NotificationSettingResult> {
    await this.settingRepository.save(userId, pushEnabled);
    return { pushEnabled };
  }
}
