import { Inject, Injectable } from '@nestjs/common';
import {
  PUSH_DEVICE_REPOSITORY,
  type PushDeviceRepository,
} from '../../domain/repositories/push-device.repository.js';

/**
 * 푸시 기기 해제 유스케이스. 앱이 로그아웃하기 전에 부른다 —
 * 로그아웃한 기기에 그 계정의 알림이 계속 뜨면 안 된다. 등록되지 않은 토큰이어도 성공으로 본다.
 */
@Injectable()
export class UnregisterPushDeviceUseCase {
  constructor(
    @Inject(PUSH_DEVICE_REPOSITORY)
    private readonly pushDeviceRepository: PushDeviceRepository,
  ) {}

  async execute(userId: string, token: string): Promise<void> {
    await this.pushDeviceRepository.deleteByUserAndToken(userId, token);
  }
}
