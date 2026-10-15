import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { assertDocumentsReady } from '../../domain/entities/driver-document.entity.js';
import { Driver, VehicleInfo } from '../../domain/entities/driver.entity.js';
import {
  DRIVER_DOCUMENT_REPOSITORY,
  type DriverDocumentRepository,
} from '../../domain/repositories/driver-support.repositories.js';
import {
  DRIVER_REPOSITORY,
  type DriverRepository,
} from '../../domain/repositories/driver.repository.js';
import { MyDriverResult } from '../dto/driver.result.js';
import { DriverProfile } from '../services/driver-profile.js';

/**
 * 기사 등록 신청 유스케이스. 서류를 모두 올린 뒤에 신청할 수 있다.
 * 반려된 기사는 문제가 된 서류를 다시 올린 뒤 같은 경로로 다시 신청한다.
 */
@Injectable()
export class RegisterDriverUseCase {
  constructor(
    @Inject(DRIVER_REPOSITORY)
    private readonly driverRepository: DriverRepository,
    @Inject(DRIVER_DOCUMENT_REPOSITORY)
    private readonly documentRepository: DriverDocumentRepository,
    private readonly driverProfile: DriverProfile,
  ) {}

  async execute(userId: string, info: VehicleInfo): Promise<MyDriverResult> {
    assertDocumentsReady(await this.documentRepository.findByUserId(userId));

    const now = new Date();
    let driver = await this.driverRepository.findByUserId(userId);
    if (driver) {
      driver.reapply(info, now);
    } else {
      driver = Driver.apply({ id: randomUUID(), userId, now, ...info });
    }
    await this.driverRepository.save(driver);
    return this.driverProfile.toResult(driver);
  }
}
