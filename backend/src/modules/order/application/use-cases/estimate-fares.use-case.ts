import { Inject, Injectable } from '@nestjs/common';
import {
  ServiceType,
  VEHICLE_SPECS,
  VehicleType,
} from '../../../../common/domain/vehicle-type.js';
import { FarePolicy } from '../../domain/services/fare-policy.js';
import { GeoPoint } from '../../domain/value-objects/geo-point.js';
import { FareEstimatesResult, toCoordinates } from '../dto/order.result.js';
import {
  ROUTE_PLANNER,
  type RoutePlanner,
} from '../ports/route-planner.port.js';

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface EstimateFaresQuery {
  pickup: Coordinates;
  dropoff: Coordinates;
  /** 주면 그 서비스의 차종만 견적한다. */
  serviceType?: ServiceType;
}

/** 요금 견적 유스케이스. 경로를 한 번 구해 차종별 요금을 모두 돌려준다. */
@Injectable()
export class EstimateFaresUseCase {
  constructor(
    @Inject(ROUTE_PLANNER)
    private readonly routePlanner: RoutePlanner,
  ) {}

  async execute(query: EstimateFaresQuery): Promise<FareEstimatesResult> {
    const route = await this.routePlanner.plan(
      GeoPoint.of(query.pickup.latitude, query.pickup.longitude),
      GeoPoint.of(query.dropoff.latitude, query.dropoff.longitude),
    );
    return {
      distanceKm: route.distanceKm,
      durationMinutes: route.durationMinutes,
      route: route.path.map(toCoordinates),
      options: Object.values(VehicleType)
        .filter(
          (type) =>
            !query.serviceType ||
            VEHICLE_SPECS[type].serviceType === query.serviceType,
        )
        .map((type) => ({
          vehicleType: type,
          ...VEHICLE_SPECS[type],
          fare: FarePolicy.quote(type, route.distanceKm).amount,
        })),
    };
  }
}
