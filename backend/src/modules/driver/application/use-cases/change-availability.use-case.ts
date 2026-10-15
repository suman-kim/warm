import { Inject, Injectable } from '@nestjs/common';
import {
  DRIVER_SHIFT_REPOSITORY,
  type DriverShiftRepository,
} from '../../domain/repositories/driver-support.repositories.js';
import {
  DRIVER_REPOSITORY,
  type DriverRepository,
} from '../../domain/repositories/driver.repository.js';
import { MyDriverResult } from '../dto/driver.result.js';
import { DriverProfile } from '../services/driver-profile.js';

/** 운행 시작(온라인)·종료(오프라인) 유스케이스. 운행 시간을 재기 위해 켜고 끈 시각을 남긴다. */
@Injectable()
export class ChangeAvailabilityUseCase {
  constructor(
    @Inject(DRIVER_REPOSITORY)
    private readonly driverRepository: DriverRepository,
    @Inject(DRIVER_SHIFT_REPOSITORY)
    private readonly shiftRepository: DriverShiftRepository,
    private readonly driverProfile: DriverProfile,
  ) {}

  async execute(userId: string, available: boolean): Promise<MyDriverResult> {
    const driver = await this.driverProfile.load(userId);
    driver.changeAvailability(available);
    await this.driverRepository.save(driver);

    const now = new Date();
    if (available) {
      await this.shiftRepository.start(driver.id, now);
    } else {
      await this.shiftRepository.end(driver.id, now);
    }
    return this.driverProfile.toResult(driver, now);
  }
}
