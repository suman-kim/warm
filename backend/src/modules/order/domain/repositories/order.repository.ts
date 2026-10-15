import { Paged, PageRequest } from '../../../../common/domain/pagination.js';
import {
  ServiceType,
  VehicleType,
} from '../../../../common/domain/vehicle-type.js';
import { Order } from '../entities/order.entity.js';
import { OrderStatus } from '../order-status.js';

/** 주문 저장소 DI 토큰. */
export const ORDER_REPOSITORY = Symbol('ORDER_REPOSITORY');

export interface OrderFilter {
  status?: OrderStatus;
  serviceType?: ServiceType;
}

/**
 * 정산에 들어가는 주문 한 건: 기간에 배송을 완료한 주문,
 * 그리고 취소 수수료가 붙은 고객 취소와 노쇼(기사에게 취소 보상을 줄 수 있다).
 */
export interface SettlementEntry {
  driverId: string;
  status: OrderStatus;
  /** 최종 요금 (배차 때 요금 + 추가 요금 + 대기료) */
  totalFare: number;
  /** 그중 추가 요금과 대기료 */
  extraFare: number;
  cancellationFee: number;
  /** 배송을 완료한(취소된·노쇼로 처리된) 시각 */
  finishedAt: Date;
}

/** 기간. from 이상 to 미만. */
export interface Period {
  from: Date;
  to: Date;
}

/** 주문 저장소 계약. */
export interface OrderRepository {
  /**
   * 주문을 저장한다. 읽은 뒤 다른 요청이 먼저 저장했으면 ConflictError —
   * 두 기사가 같은 주문을 동시에 수락해도 한 명만 성공한다.
   */
  save(order: Order): Promise<void>;
  findById(id: string): Promise<Order | null>;
  /** 고객의 주문 (최근 요청순). */
  findByCustomer(
    customerId: string,
    filter: OrderFilter,
    page: PageRequest,
  ): Promise<Paged<Order>>;
  /**
   * 기사가 배차받은 주문. 끝난(완료·취소) 시각이 최근인 순이고, 아직 진행 중이면 배차 시각을 쓴다.
   * [period]를 주면 그 시각이 기간 안인 것만.
   */
  findByDriver(
    driverId: string,
    filter: OrderFilter & { period?: Period },
    page: PageRequest,
  ): Promise<Paged<Order>>;
  /** 기간 안에 배송을 완료했거나 취소·노쇼로 끝난, 기사의 주문 전부. 수입 집계에 쓴다. */
  findFinishedByDriver(driverId: string, period: Period): Promise<Order[]>;
  /** [period]에 끝난, 정산에 들어가는 주문. [driverId]를 주면 그 기사의 것만. */
  findSettlementEntries(
    period: Period,
    driverId?: string,
  ): Promise<SettlementEntry[]>;
  /** 이 차종의 기사가 수락할 수 있는 배차 대기 주문 (최근 요청순). */
  findOpen(vehicleType: VehicleType, page: PageRequest): Promise<Paged<Order>>;
  /** 픽업지가 [near]에서 [radiusKm] 안인 배차 대기 주문 (가까운 순, 같으면 최근 요청순). */
  findOpenNear(
    vehicleType: VehicleType,
    near: { latitude: number; longitude: number },
    radiusKm: number,
    page: PageRequest,
  ): Promise<Paged<Order>>;
  /** 고객의 가장 최근 주문들. 최근 보낸 곳을 뽑는 데 쓴다. */
  findRecentByCustomer(customerId: string, limit: number): Promise<Order[]>;
  /** 아직 끝나지 않은(배차 대기·결제 중·결제 실패·진행 중) 주문이 있는지. */
  hasUnfinishedByCustomer(customerId: string): Promise<boolean>;
  /** 기사가 맡아 진행 중인(배차 완료 ~ 배송 완료 전) 주문이 있는지. */
  hasInProgressByDriver(driverId: string): Promise<boolean>;
}
