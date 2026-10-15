import { Paged, PageRequest } from '../../../../common/domain/pagination.js';
import { VehicleType } from '../../../../common/domain/vehicle-type.js';
import { DriverStatus } from '../driver-status.js';
import { Driver } from '../entities/driver.entity.js';

/** 기사 저장소 DI 토큰. */
export const DRIVER_REPOSITORY = Symbol('DRIVER_REPOSITORY');

/** 기사 저장소 계약. */
export interface DriverRepository {
  save(driver: Driver): Promise<void>;
  findById(id: string): Promise<Driver | null>;
  findByIds(ids: string[]): Promise<Driver[]>;
  findByUserId(userId: string): Promise<Driver | null>;
  /**
   * 지금 이 차종의 주문을 수락할 수 있는 기사 중, [near]에서 반경 안에 [freshSince] 뒤로 위치를 보낸
   * 기사들의 회원 ID. 수락 조건은 Driver.canAcceptOrders()와 같다 (승인됐고 운행 중).
   */
  findAvailableUserIdsNear(
    vehicleType: VehicleType,
    near: { latitude: number; longitude: number; radiusKm: number },
    freshSince: Date,
  ): Promise<string[]>;
  /** 신청순(오래된 것부터) 목록. status를 주지 않으면 전체. */
  findAll(
    filter: { status?: DriverStatus },
    page: PageRequest,
  ): Promise<Paged<Driver>>;
}
