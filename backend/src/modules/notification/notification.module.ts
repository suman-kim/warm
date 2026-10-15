import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { parseFirebaseServiceAccount } from '../../config/firebase.config.js';
import { DriverModule } from '../driver/driver.module.js';
import { PUSH_AUDIENCE } from './application/ports/push-audience.port.js';
import {
  PUSH_SENDER,
  PushSender,
} from './application/ports/push-sender.port.js';
import { PushNotifier } from './application/services/push-notifier.js';
import { NotificationInboxUseCase } from './application/use-cases/notification-inbox.use-case.js';
import { NotifyEventUseCase } from './application/use-cases/notify-event.use-case.js';
import { RegisterPushDeviceUseCase } from './application/use-cases/register-push-device.use-case.js';
import { UnregisterPushDeviceUseCase } from './application/use-cases/unregister-push-device.use-case.js';
import {
  NOTIFICATION_REPOSITORY,
  NOTIFICATION_SETTING_REPOSITORY,
} from './domain/repositories/notification.repositories.js';
import { PUSH_DEVICE_REPOSITORY } from './domain/repositories/push-device.repository.js';
import { PushAudienceAdapter } from './infrastructure/adapters/push-audience.adapter.js';
import { NotificationOrmEntity } from './infrastructure/entities/notification.orm-entity.js';
import { NotificationSettingOrmEntity } from './infrastructure/entities/notification-setting.orm-entity.js';
import { PushDeviceOrmEntity } from './infrastructure/entities/push-device.orm-entity.js';
import { EventPushListener } from './infrastructure/listeners/event-push.listener.js';
import { DisabledPushSender } from './infrastructure/push/disabled-push.sender.js';
import { FcmPushSender } from './infrastructure/push/fcm-push.sender.js';
import { createFcmMessaging } from './infrastructure/push/firebase-messaging.factory.js';
import {
  NotificationSettingTypeormRepository,
  NotificationTypeormRepository,
} from './infrastructure/repositories/notification.typeorm.repositories.js';
import { PushDeviceTypeormRepository } from './infrastructure/repositories/push-device.typeorm.repository.js';
import { NotificationController } from './presentation/controllers/notification.controller.js';
import { PushDeviceController } from './presentation/controllers/push-device.controller.js';

/**
 * 알림 모듈. 푸시 기기를 등록받고, 주문·기사 이벤트를 알림으로 바꿔
 * 알림함에 남기고 푸시로 보낸다. 다른 모듈은 이 모듈을 모른다 — 이벤트로만 이어진다.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      PushDeviceOrmEntity,
      NotificationOrmEntity,
      NotificationSettingOrmEntity,
    ]),
    // PushAudienceAdapter가 기사 저장소를 읽는다.
    DriverModule,
  ],
  controllers: [PushDeviceController, NotificationController],
  providers: [
    PushNotifier,
    RegisterPushDeviceUseCase,
    UnregisterPushDeviceUseCase,
    NotifyEventUseCase,
    NotificationInboxUseCase,
    EventPushListener,
    { provide: PUSH_DEVICE_REPOSITORY, useClass: PushDeviceTypeormRepository },
    {
      provide: NOTIFICATION_REPOSITORY,
      useClass: NotificationTypeormRepository,
    },
    {
      provide: NOTIFICATION_SETTING_REPOSITORY,
      useClass: NotificationSettingTypeormRepository,
    },
    { provide: PUSH_AUDIENCE, useClass: PushAudienceAdapter },
    {
      provide: PUSH_SENDER,
      inject: [ConfigService],
      // 서비스 계정이 있으면 FCM으로 보내고, 없으면 로그만 남긴다 (Firebase 없이도 서버가 뜬다).
      // 값이 있는데 형식이 틀리면 여기서 던져 부팅이 실패한다.
      useFactory: (config: ConfigService): PushSender => {
        const account = parseFirebaseServiceAccount(
          config.get<string>('FIREBASE_SERVICE_ACCOUNT_BASE64'),
        );
        return account
          ? new FcmPushSender(createFcmMessaging(account))
          : new DisabledPushSender();
      },
    },
  ],
  // 탈퇴할 때 그 회원의 기기와 알림을 지운다.
  exports: [
    PUSH_DEVICE_REPOSITORY,
    NOTIFICATION_REPOSITORY,
    NOTIFICATION_SETTING_REPOSITORY,
  ],
})
export class NotificationModule {}
