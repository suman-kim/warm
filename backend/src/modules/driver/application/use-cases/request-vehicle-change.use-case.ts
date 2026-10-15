import { Inject, Injectable } from '@nestjs/common';
import { VehicleInfo } from '../../domain/entities/driver.entity.js';
import {
  DRIVER_REPOSITORY,
  type DriverRepository,
} from '../../domain/repositories/driver.repository.js';
import { MyDriverResult } from '../dto/driver.result.js';
import { DriverProfile } from '../services/driver-profile.js';

/** 차량 변경 신청 유스케이스. 신청하면 다시 심사 대기가 되고, 승인 전까지 운행할 수 없다. */
@Injectable()
export class RequestVehicleChangeUseCase {
  constructor(
    @Inject(DRIVER_REPOSITORY)
    private readonly driverRepository: DriverRepository,
    private readonly driverProfile: DriverProfile,
  ) {}

  async execute(userId: string, info: VehicleInfo): Promise<MyDriverResult> {
    const driver = await this.driverProfile.load(userId);
    driver.requestVehicleChange(info, new Date());
    await this.driverRepository.save(driver);
    return this.driverProfile.toResult(driver);
  }
}
