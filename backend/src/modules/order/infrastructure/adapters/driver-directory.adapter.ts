import { Inject, Injectable } from '@nestjs/common';
import { Driver } from '../../../driver/domain/entities/driver.entity.js';
import {
  DRIVER_LOCATION_REPOSITORY,
  type DriverLocationRepository,
} from '../../../driver/domain/repositories/driver-support.repositories.js';
import {
  DRIVER_REPOSITORY,
  type DriverRepository,
} from '../../../driver/domain/repositories/driver.repository.js';
import {
  USER_REPOSITORY,
  type UserRepository,
} from '../../../user/domain/repositories/user.repository.js';
import {
  DispatchDriver,
  DriverDirectory,
  DriverLocation,
} from '../../application/ports/driver-directory.port.js';
import { GeoPoint } from '../../domain/value-objects/geo-point.js';

/**
 * 기사 조회 포트 구현체. 기사·회원 컨텍스트의 저장소를 읽어
 * 주문 컨텍스트의 모델(DispatchDriver)로 옮긴다.
 */
@Injectable()
export class DriverDirectoryAdapter implements DriverDirectory {
  constructor(
    @Inject(DRIVER_REPOSITORY)
    private readonly driverRepository: DriverRepository,
    @Inject(DRIVER_LOCATION_REPOSITORY)
    private readonly locationRepository: DriverLocationRepository,
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepository,
  ) {}

  async findByUserId(userId: string): Promise<DispatchDriver | null> {
    return this.toDispatchDriver(
      await this.driverRepository.findByUserId(userId),
    );
  }

  async findById(driverId: string): Promise<DispatchDriver | null> {
    return this.toDispatchDriver(
      await this.driverRepository.findById(driverId),
    );
  }

  async findNames(driverIds: string[]): Promise<Map<string, string>> {
    const drivers = await this.driverRepository.findByIds(driverIds);
    const users = await this.userRepository.findByIds(
      drivers.map((driver) => driver.userId),
    );
    const nameByUserId = new Map(users.map((user) => [user.id, user.name]));
    return new Map(
      drivers.flatMap((driver) => {
        const name = nameByUserId.get(driver.userId);
        return name ? [[driver.id, name] as const] : [];
      }),
    );
  }

  async findLocation(driverId: string): Promise<DriverLocation | null> {
    const location = await this.locationRepository.find(driverId);
    return (
      location && {
        point: GeoPoint.of(location.latitude, location.longitude),
        updatedAt: location.updatedAt,
      }
    );
  }

  private async toDispatchDriver(
    driver: Driver | null,
  ): Promise<DispatchDriver | null> {
    const user = driver && (await this.userRepository.findById(driver.userId));
    if (!driver || !user) {
      return null;
    }
    const state = driver.snapshot();
    return {
      id: driver.id,
      userId: driver.userId,
      name: user.name,
      phone: user.phone,
      vehicleType: state.vehicleType,
      vehicleNumber: state.vehicleNumber,
      canAcceptOrders: driver.canAcceptOrders(),
    };
  }
}
