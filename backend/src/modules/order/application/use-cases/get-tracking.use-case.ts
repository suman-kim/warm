import { Inject, Injectable } from '@nestjs/common';
import { AuthenticatedUser } from '../../../../common/application/authenticated-user.js';
import { OrderStatus } from '../../domain/order-status.js';
import { TrackingResult } from '../dto/order.result.js';
import {
  DRIVER_DIRECTORY,
  type DriverDirectory,
} from '../ports/driver-directory.port.js';
import {
  ROUTE_PLANNER,
  type RoutePlanner,
} from '../ports/route-planner.port.js';
import { OrderAccess } from '../services/order-access.js';

const MINUTE_MS = 60_000;

/**
 * 배송 추적 유스케이스. 진행 중인 주문의 기사 위치와, 그 위치에서 다시 어림한
 * 픽업·도착 예정 시각을 준다. 고객 앱이 배송 중 화면에서 주기적으로 부른다.
 */
@Injectable()
export class GetTrackingUseCase {
  constructor(
    private readonly orderAccess: OrderAccess,
    @Inject(DRIVER_DIRECTORY)
    private readonly driverDirectory: DriverDirectory,
    @Inject(ROUTE_PLANNER)
    private readonly routePlanner: RoutePlanner,
  ) {}

  async execute(
    requester: AuthenticatedUser,
    orderId: string,
  ): Promise<TrackingResult> {
    const { order } = await this.orderAccess.load(requester, orderId);
    const state = order.snapshot();
    const location =
      order.isInProgress() && state.driverId
        ? await this.driverDirectory.findLocation(state.driverId)
        : null;
    if (!location) {
      return {
        status: state.status,
        driverLocation: null,
        estimatedPickupAt: state.estimatedPickupAt,
        estimatedDeliveryAt: order.estimatedDeliveryAt,
      };
    }

    // 기사의 지금 위치에서 다음 목적지까지 다시 어림한다.
    const now = Date.now();
    const pickedUp = state.status === OrderStatus.PICKED_UP;
    const leg = await this.routePlanner.plan(
      location.point,
      pickedUp ? state.dropoff.point : state.pickup.point,
    );
    const arrival = new Date(now + leg.durationMinutes * MINUTE_MS);
    return {
      status: state.status,
      driverLocation: {
        latitude: location.point.latitude,
        longitude: location.point.longitude,
        updatedAt: location.updatedAt,
      },
      estimatedPickupAt: pickedUp ? state.pickedUpAt : arrival,
      estimatedDeliveryAt: pickedUp
        ? arrival
        : new Date(arrival.getTime() + state.durationMinutes * MINUTE_MS),
    };
  }
}
