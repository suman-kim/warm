import { IsEnum, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import {
  MAX_PUSH_TOKEN_LENGTH,
  PushPlatform,
} from '../../domain/entities/push-device.entity.js';

export class RegisterPushDeviceRequest {
  /** FCM 등록 토큰. iOS도 APNs 토큰이 아니라 FCM 토큰을 보낸다. */
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_PUSH_TOKEN_LENGTH)
  token: string;

  @IsEnum(PushPlatform)
  platform: PushPlatform;
}
