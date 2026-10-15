import { VehicleType } from '../../../../common/domain/vehicle-type.js';
import { GeoPoint } from '../../domain/value-objects/geo-point.js';

/** 기사 조회 포트 DI 토큰. */
export const DRIVER_DIRECTORY = Symbol('DRIVER_DIRECTORY');

/** 주문 컨텍스트에서 본 기사. 배차에 필요한 것만 담는다. */
export interface DispatchDriver {
  id: string;
  userId: string;
  name: string;
  phone: string;
  vehicleType: VehicleType;
  vehicleNumber: string;
  /** 승인됐고 운행 중(온라인)이라 배차를 받을 수 있는지 */
  canAcceptOrders: boolean;
}

export interface DriverLocation {
  point: GeoPoint;
  updatedAt: Date;
}

/**
 * 기사 조회 포트. 주문 컨텍스트가 기사 컨텍스트를 직접 알지 않도록 사이에 둔다.
 */
export interface DriverDirectory {
  findByUserId(userId: string): Promise<DispatchDriver | null>;
  findById(driverId: string): Promise<DispatchDriver | null>;
  /** 여러 기사의 이름을 한 번에. 없는 기사는 결과에 없다. */
  findNames(driverIds: string[]): Promise<Map<string, string>>;
  /** 기사 앱이 마지막으로 보낸 위치. 보낸 적이 없으면 null. */
  findLocation(driverId: string): Promise<DriverLocation | null>;
}
