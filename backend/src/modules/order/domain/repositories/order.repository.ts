import { Paged, PageRequest } from '../../../../common/domain/pagination.js';
import { Order } from '../entities/order.entity.js';
import { OrderStatus } from '../order-status.js';

/** 배달 저장소 DI 토큰. */
export const ORDER_REPOSITORY = Symbol('ORDER_REPOSITORY');

export interface OrderFilter {
  status?: OrderStatus;
}

/**
 * 정산에 들어가는 배달 한 건: 기간에 완료한 배달,
 * 그리고 취소 수수료가 붙은 가게 취소(라이더에게 취소 보상을 줄 수 있다).
 */
export interface SettlementEntry {
  driverId: string;
  status: OrderStatus;
  /** 배달대행료 */
  fare: number;
  cancellationFee: number;
  /** 배달을 완료한(취소된) 시각 */
  finishedAt: Date;
}

/** 기간. from 이상 to 미만. */
export interface Period {
  from: Date;
  to: Date;
}

/** 배달 저장소 계약. */
export interface OrderRepository {
  /**
   * 배달을 저장한다. 읽은 뒤 다른 요청이 먼저 저장했으면 ConflictError —
   * 두 라이더가 같은 배달을 동시에 수락해도 한 명만 성공한다.
   */
  save(order: Order): Promise<void>;
  findById(id: string): Promise<Order | null>;
  /** 고객(가게 사장님)의 주문 (최근 요청순). [period]를 주면 요청 시각이 그 안인 것만. */
  findByCustomer(
    customerId: string,
    filter: OrderFilter & { period?: Period },
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
  /** 기간 안에 배달을 완료했거나 취소로 끝난, 라이더의 배달 전부. 수입 집계에 쓴다. */
  findFinishedByDriver(driverId: string, period: Period): Promise<Order[]>;
  /** [period]에 끝난, 정산에 들어가는 주문. [driverId]를 주면 그 기사의 것만. */
  findSettlementEntries(
    period: Period,
    driverId?: string,
  ): Promise<SettlementEntry[]>;
  /** 라이더가 수락할 수 있는 배차 대기 배달 (최근 요청순). */
  findOpen(page: PageRequest): Promise<Paged<Order>>;
  /** 가게가 [near]에서 [radiusKm] 안인 배차 대기 배달 (가까운 순, 같으면 최근 요청순). */
  findOpenNear(
    near: { latitude: number; longitude: number },
    radiusKm: number,
    page: PageRequest,
  ): Promise<Paged<Order>>;
  /** 가게의 가장 최근 배달들. 최근 배달한 주소를 뽑는 데 쓴다. */
  findRecentByCustomer(customerId: string, limit: number): Promise<Order[]>;
  /** 아직 끝나지 않은(배차 대기·진행 중) 배달이 있는지. */
  hasUnfinishedByCustomer(customerId: string): Promise<boolean>;
  /** 기사가 맡아 진행 중인(배차 완료 ~ 배송 완료 전) 주문의 수. 묶음배송 한도를 지키는 데 쓴다. */
  countInProgressByDriver(driverId: string): Promise<number>;
  /** 기사가 맡아 진행 중인(배차 완료 ~ 배송 완료 전) 주문이 있는지. */
  hasInProgressByDriver(driverId: string): Promise<boolean>;
}
