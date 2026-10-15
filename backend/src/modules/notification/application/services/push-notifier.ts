import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { Notification } from '../../domain/entities/notification.entity.js';
import { PushMessage } from '../../domain/push-message.js';
import {
  NOTIFICATION_REPOSITORY,
  NOTIFICATION_SETTING_REPOSITORY,
  type NotificationRepository,
  type NotificationSettingRepository,
} from '../../domain/repositories/notification.repositories.js';
import {
  PUSH_DEVICE_REPOSITORY,
  type PushDeviceRepository,
} from '../../domain/repositories/push-device.repository.js';
import { PUSH_SENDER, type PushSender } from '../ports/push-sender.port.js';

/** 회원들에게 알린다: 알림함에 남기고, 푸시를 켜 둔 회원의 모든 기기로 보낸다. */
@Injectable()
export class PushNotifier {
  constructor(
    @Inject(PUSH_DEVICE_REPOSITORY)
    private readonly pushDeviceRepository: PushDeviceRepository,
    @Inject(NOTIFICATION_REPOSITORY)
    private readonly notificationRepository: NotificationRepository,
    @Inject(NOTIFICATION_SETTING_REPOSITORY)
    private readonly settingRepository: NotificationSettingRepository,
    @Inject(PUSH_SENDER)
    private readonly pushSender: PushSender,
  ) {}

  /**
   * [keepInInbox]가 true면 알림함에도 남긴다. 푸시를 꺼 둔 회원도 알림함에서는 볼 수 있다.
   * 금방 낡는 알림(새 콜, 메시지)은 남기지 않는다.
   */
  async notifyUsers(
    userIds: string[],
    message: PushMessage,
    options: { keepInInbox: boolean },
  ): Promise<void> {
    if (userIds.length === 0) {
      return;
    }
    if (options.keepInInbox) {
      const now = new Date();
      await this.notificationRepository.saveAll(
        userIds.map((userId) =>
          Notification.from(randomUUID(), userId, message, now),
        ),
      );
    }

    const disabled = await this.settingRepository.findPushDisabled(userIds);
    const recipients = userIds.filter((userId) => !disabled.has(userId));
    const tokens =
      await this.pushDeviceRepository.findTokensByUserIds(recipients);
    if (tokens.length === 0) {
      return;
    }
    const { invalidTokens } = await this.pushSender.send(tokens, message);
    // 앱을 지운 기기의 토큰을 두면 보낼 때마다 실패가 쌓인다.
    if (invalidTokens.length > 0) {
      await this.pushDeviceRepository.deleteByTokens(invalidTokens);
    }
  }
}
