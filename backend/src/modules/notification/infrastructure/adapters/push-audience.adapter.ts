import { Inject, Injectable } from '@nestjs/common';
import { freshLocationSince } from '../../../../common/domain/dispatch-area.js';
import { VehicleType } from '../../../../common/domain/vehicle-type.js';
import {
  DRIVER_REPOSITORY,
  type DriverRepository,
} from '../../../driver/domain/repositories/driver.repository.js';
import { PushAudience } from '../../application/ports/push-audience.port.js';

/** 알림 대상 조회 포트 구현체. 기사 컨텍스트의 저장소를 읽는다. */
@Injectable()
export class PushAudienceAdapter implements PushAudience {
  constructor(
    @Inject(DRIVER_REPOSITORY)
    private readonly driverRepository: DriverRepository,
  ) {}

  findAvailableDriverUserIds(
    vehicleType: VehicleType,
    near: { latitude: number; longitude: number; radiusKm: number },
  ): Promise<string[]> {
    return this.driverRepository.findAvailableUserIdsNear(
      vehicleType,
      near,
      freshLocationSince(new Date()),
    );
  }

  async findDriverUserId(driverId: string): Promise<string | null> {
    const driver = await this.driverRepository.findById(driverId);
    return driver?.userId ?? null;
  }
}
