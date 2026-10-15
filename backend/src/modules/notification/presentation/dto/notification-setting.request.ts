import { IsBoolean } from 'class-validator';

export class UpdateNotificationSettingRequest {
  /** 푸시 알림을 받을지. 꺼도 알림함에는 쌓인다. */
  @IsBoolean()
  pushEnabled: boolean;
}
