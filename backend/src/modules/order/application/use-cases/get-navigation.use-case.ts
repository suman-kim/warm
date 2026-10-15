import { Inject, Injectable } from '@nestjs/common';
import { ConflictError } from '../../../../common/domain/domain-error.js';
import { AuthenticatedUser } from '../../../../common/application/authenticated-user.js';
import { OrderStatus } from '../../domain/order-status.js';
import { GeoPoint } from '../../domain/value-objects/geo-point.js';
import { NavigationResult, toCoordinates } from '../dto/order.result.js';
import {
  DRIVER_DIRECTORY,
  type DriverDirectory,
} from '../ports/driver-directory.port.js';
import {
  ROUTE_PLANNER,
  type RoutePlanner,
} from '../ports/route-planner.port.js';
import { OrderAccess } from '../services/order-access.js';
import { Coordinates } from './estimate-fares.use-case.js';

/**
 * 길안내 유스케이스 (기사). 배차받은 주문에서 다음에 갈 곳(픽업 전이면 픽업지,
 * 픽업한 뒤면 도착지)까지의 거리·시간·경로를 준다.
 */
@Injectable()
export class GetNavigationUseCase {
  constructor(
    private readonly orderAccess: OrderAccess,
    @Inject(DRIVER_DIRECTORY)
    private readonly driverDirectory: DriverDirectory,
    @Inject(ROUTE_PLANNER)
    private readonly routePlanner: RoutePlanner,
  ) {}

  /** [from]은 기사 앱의 지금 위치다. 주지 않으면 마지막으로 보낸 위치를 쓴다. */
  async execute(
    requester: AuthenticatedUser,
    orderId: string,
    from?: Coordinates,
  ): Promise<NavigationResult> {
    const { order, viewerDriver } = await this.orderAccess.load(
      requester,
      orderId,
    );
    if (!viewerDriver || !order.isInProgress()) {
      throw new ConflictError(
        'ORDER_NOT_IN_PROGRESS',
        '진행 중인 배송이 아니에요.',
      );
    }
    const origin = from
      ? GeoPoint.of(from.latitude, from.longitude)
      : (await this.driverDirectory.findLocation(viewerDriver.id))?.point;
    if (!origin) {
      throw new ConflictError(
        'LOCATION_REQUIRED',
        '현재 위치를 알 수 없어요. 위치를 함께 보내 주세요.',
      );
    }

    const state = order.snapshot();
    const pickedUp = state.status === OrderStatus.PICKED_UP;
    const destination = pickedUp ? state.dropoff : state.pickup;
    const route = await this.routePlanner.plan(origin, destination.point);
    return {
      target: pickedUp ? 'DROPOFF' : 'PICKUP',
      address: destination.address,
      latitude: destination.point.latitude,
      longitude: destination.point.longitude,
      distanceKm: route.distanceKm,
      durationMinutes: route.durationMinutes,
      route: route.path.map(toCoordinates),
    };
  }
}
