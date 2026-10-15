import { Injectable } from '@nestjs/common';
import { MyDriverResult } from '../dto/driver.result.js';
import { DriverProfile } from '../services/driver-profile.js';

/** 내 기사 정보 조회 유스케이스. */
@Injectable()
export class GetMyDriverUseCase {
  constructor(private readonly driverProfile: DriverProfile) {}

  async execute(userId: string): Promise<MyDriverResult> {
    return this.driverProfile.toResult(await this.driverProfile.load(userId));
  }
}
