import { VehicleType } from '../../../../common/domain/vehicle-type.js';
import { DriverStatus } from '../../domain/driver-status.js';
import { Driver } from '../../domain/entities/driver.entity.js';
import { DriverOrmEntity } from '../entities/driver.orm-entity.js';

/** 기사 도메인 ↔ ORM 매퍼. */
export class DriverMapper {
  static toOrm(driver: Driver): DriverOrmEntity {
    const state = driver.snapshot();
    const orm = new DriverOrmEntity();
    orm.id = state.id;
    orm.userId = state.userId;
    orm.vehicleType = state.vehicleType;
    orm.vehicleNumber = state.vehicleNumber;
    orm.status = state.status;
    orm.available = state.available;
    orm.rejectionReason = state.rejectionReason;
    orm.previousRejectionReason = state.previousRejectionReason;
    orm.approvedAt = state.approvedAt;
    orm.appliedAt = state.appliedAt;
    orm.reviewedAt = state.reviewedAt;
    orm.reviewedBy = state.reviewedBy;
    orm.createdAt = state.createdAt;
    return orm;
  }

  static toDomain(orm: DriverOrmEntity): Driver {
    return Driver.restore(
      {
        id: orm.id,
        userId: orm.userId,
        vehicleType: orm.vehicleType as VehicleType,
        vehicleNumber: orm.vehicleNumber,
        status: orm.status as DriverStatus,
        available: orm.available,
        rejectionReason: orm.rejectionReason,
        previousRejectionReason: orm.previousRejectionReason,
        approvedAt: orm.approvedAt,
        appliedAt: orm.appliedAt,
        reviewedAt: orm.reviewedAt,
        reviewedBy: orm.reviewedBy,
        createdAt: orm.createdAt,
      },
      orm.version,
    );
  }
}
