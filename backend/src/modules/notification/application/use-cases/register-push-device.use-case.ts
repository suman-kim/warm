import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import {
  PushDevice,
  PushPlatform,
} from '../../domain/entities/push-device.entity.js';
import {
  PUSH_DEVICE_REPOSITORY,
  type PushDeviceRepository,
} from '../../domain/repositories/push-device.repository.js';

/**
 * 푸시 기기 등록 유스케이스. 앱이 로그인한 뒤, 그리고 토큰이 새로 발급될 때마다 부른다.
 * 같은 토큰으로 다시 불러도 된다.
 */
@Injectable()
export class RegisterPushDeviceUseCase {
  constructor(
    @Inject(PUSH_DEVICE_REPOSITORY)
    private readonly pushDeviceRepository: PushDeviceRepository,
  ) {}

  async execute(
    userId: string,
    token: string,
    platform: PushPlatform,
  ): Promise<void> {
    await this.pushDeviceRepository.save(
      PushDevice.register({
        id: randomUUID(),
        userId,
        token,
        platform,
        now: new Date(),
      }),
    );
  }
}
