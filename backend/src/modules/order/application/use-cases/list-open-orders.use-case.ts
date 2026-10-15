import { Inject, Injectable } from '@nestjs/common';
import {
  PageQuery,
  toPageRequest,
} from '../../../../common/application/page.js';
import {
  DISPATCH_RADIUS_KM,
  freshLocationSince,
} from '../../../../common/domain/dispatch-area.js';
import {
  ConflictError,
  NotFoundError,
} from '../../../../common/domain/domain-error.js';
import { OrderStatus } from '../../domain/order-status.js';
import {
  ORDER_REPOSITORY,
  type OrderRepository,
} from '../../domain/repositories/order.repository.js';
import {
  OpenOrderPageResult,
  OpenOrderResult,
  toOpenOrderResult,
} from '../dto/order.result.js';
import {
  DRIVER_DIRECTORY,
  type DriverDirectory,
} from '../ports/driver-directory.port.js';
import { DriverOrderTransition } from '../services/driver-order-transition.js';

/**
 * 배차 대기 주문 조회 유스케이스 (기사). 내 차종으로 요청된 주문만 보인다.
 * 기사 앱이 위치를 보내고 있으면 배차 반경 안의 주문만 가까운 순으로 보여 주고 픽업지까지의 거리를 함께 준다.
 * 최근 위치가 없으면(권한이 없거나 앱이 위치를 못 보냈다) 내 차종의 대기 주문 전부를 최근 요청순으로 보여 준다.
 */
@Injectable()
export class ListOpenOrdersUseCase {
  constructor(
    @Inject(ORDER_REPOSITORY)
    private readonly orderRepository: OrderRepository,
    @Inject(DRIVER_DIRECTORY)
    private readonly driverDirectory: DriverDirectory,
    private readonly transition: DriverOrderTransition,
  ) {}

  async execute(userId: string, page: PageQuery): Promise<OpenOrderPageResult> {
    const driver = await this.transition.requireDispatchableDriver(userId);
    const location = await this.driverDirectory.findLocation(driver.id);
    const fresh =
      location && location.updatedAt >= freshLocationSince(new Date())
        ? location
        : null;
    const radiusKm = fresh ? DISPATCH_RADIUS_KM[driver.vehicleType] : null;
    const { items, total } =
      fresh && radiusKm !== null
        ? await this.orderRepository.findOpenNear(
            driver.vehicleType,
            fresh.point,
            radiusKm,
            toPageRequest(page),
          )
        : await this.orderRepository.findOpen(
            driver.vehicleType,
            toPageRequest(page),
          );
    return {
      items: items.map((order) =>
        toOpenOrderResult(order, location?.point ?? null),
      ),
      total,
      page: page.page,
      size: page.size,
      radiusKm,
    };
  }

  /**
   * 대기 주문 하나. 새 콜 푸시를 받은 기사 앱이 그 콜의 내용을 채울 때 부른다.
   * 그사이 다른 기사가 수락했으면 ConflictError(ORDER_NOT_OPEN).
   */
  async one(userId: string, orderId: string): Promise<OpenOrderResult> {
    const driver = await this.transition.requireDispatchableDriver(userId);
    const order = await this.orderRepository.findById(orderId);
    if (!order || order.snapshot().vehicleType !== driver.vehicleType) {
      throw new NotFoundError('ORDER_NOT_FOUND', '주문을 찾을 수 없어요.');
    }
    if (order.status !== OrderStatus.REQUESTED) {
      throw new ConflictError(
        'ORDER_NOT_OPEN',
        '이미 배차됐거나 취소된 주문이에요.',
      );
    }
    const location = await this.driverDirectory.findLocation(driver.id);
    return toOpenOrderResult(order, location?.point ?? null);
  }
}
