import { VehicleType } from '../../../../common/domain/vehicle-type.js';
import { Order } from '../../domain/entities/order.entity.js';
import { OrderStatus } from '../../domain/order-status.js';
import { SettlementPolicy } from '../../domain/services/settlement-policy.js';
import { GeoPoint } from '../../domain/value-objects/geo-point.js';
import {
  CollectedMethod,
  DeliverySource,
  DoorPayment,
} from '../../domain/value-objects/store-delivery.js';
import { Waypoint } from '../../domain/value-objects/waypoint.js';
import { DispatchDriver } from '../ports/driver-directory.port.js';

/** 가게(픽업지)·손님(도착지) */
export class WaypointResult {
  address: string;
  detailAddress: string | null;
  /** 시·군·구 */
  sigungu: string | null;
  /** 동 */
  dong: string | null;
  latitude: number;
  longitude: number;
  /** 가게 이름 또는 '손님' */
  contactName: string;
  contactPhone: string;
}

/** 가게 배달 정보: 어느 가게의 배달인지, 음식값과 받는 방식, 조리 완료 시각, 받은 돈. */
export class StoreDeliveryResult {
  storeId: string;
  /** 어디서 온 배달인지: STORE_REQUEST(가게가 직접 요청) | FOOD_ORDER(주문앱 따끈 주문) */
  source: DeliverySource;
  /** 주문앱 주문에서 왔으면 그 주문 ID */
  sourceOrderId: string | null;
  /** 손님이 낼 음식값 (원) */
  foodAmount: number;
  /** 음식값을 받는 방식: PREPAID(선결제) | CASH | CARD (만나서 결제) */
  doorPayment: DoorPayment;
  /** 조리가 끝나 픽업할 수 있는 시각. 바로면 null. */
  readyAt: Date | null;
  /** 라이더가 손님에게 실제로 받은 방식과 금액 (배달 완료 뒤) */
  collectedMethod: CollectedMethod | null;
  collectedAmount: number | null;
  /** 라이더가 받은 현금을 가게에 넘긴 시각 (운영자 확인). 아직이면 null. */
  cashHandedAt: Date | null;
}

/** 콜 목록에 보이는 가게 배달 정보 — 라이더가 받을 돈을 미리 안다. */
export class OpenStoreDeliveryResult {
  /** 가게 이름 */
  storeName: string;
  /** 어디서 온 배달인지 — FOOD_ORDER면 손님이 이미 결제한 주문앱 주문이다 */
  source: DeliverySource;
  foodAmount: number;
  doorPayment: DoorPayment;
  readyAt: Date | null;
}

/** 배달 응답. 요청한 사장님과 배차된 라이더에게만 내려간다(연락처 포함). */
export class OrderResult {
  id: string;
  /** 주문번호 (예: MV261015-3F9A) — 끝 네 자리를 가게에 말한다 */
  code: string;
  customerId: string;
  status: OrderStatus;
  storeDelivery: StoreDeliveryResult;
  pickup: WaypointResult;
  dropoff: WaypointResult;
  /** 요청 사항 (라이더에게 남길 말) */
  memo: string | null;
  /** 운행 거리(km) */
  distanceKm: number;
  /** 예상 소요 시간(분) */
  durationMinutes: number;
  /** 배달대행료 (원) — 요청할 때 충전금에서 빠졌다 */
  fare: number;
  /** 취소했으면 낸 수수료 (원) */
  cancellationFee: number;
  /** 지금 취소하면 내는 수수료. 취소할 수 없으면(픽업 뒤) null. */
  cancellationFeeNow: number | null;
  driverId: string | null;
  /** 배차 때 어림한 픽업 예정 시각 */
  estimatedPickupAt: Date | null;
  /** 도착 예정 시각 */
  estimatedDeliveryAt: Date | null;
  requestedAt: Date;
  assignedAt: Date | null;
  /** 라이더가 가게로 출발한 시각 */
  departedAt: Date | null;
  arrivedAt: Date | null;
  pickedUpAt: Date | null;
  deliveredAt: Date | null;
  cancelledAt: Date | null;
  cancelReason: string | null;
}

/** 가게의 배달 목록 한 줄. 배차된 라이더 이름이 붙는다. */
export class OrderListItemResult extends OrderResult {
  /** 배차된 라이더 이름. 배차 전이면 null. */
  driverName: string | null;
}

/** 배차된 라이더 */
export class AssignedDriverResult {
  id: string;
  name: string;
  phone: string;
  vehicleType: VehicleType;
  vehicleNumber: string;
}

/** 배달 상세 응답. 배차된 라이더가 붙는다. */
export class OrderDetailResult extends OrderResult {
  /** 배차된 라이더. 배차 전이면 null. */
  driver: AssignedDriverResult | null;
}

/** 가게의 배달 목록 응답. */
export class OrderListResult {
  items: OrderListItemResult[];
  total: number;
  page: number;
  size: number;
}

/** 라이더가 보는 배달. 이 배달로 받는 금액이 붙는다. */
export class DriverOrderResult extends OrderResult {
  /**
   * 이 배달로 받는 금액(원) — 대행료에서 수수료를 뺀 값.
   * 가게가 취소했으면 취소 보상(지금 정책은 0원).
   */
  earning: number;
}

/** 라이더의 배달 목록 응답. */
export class OrderPageResult {
  items: DriverOrderResult[];
  total: number;
  page: number;
  size: number;
}

/**
 * 콜 목록의 배달. 수락하기 전이라 손님의 상세 주소와 연락처는 주지 않고,
 * 위치는 동 단위(소수 둘째 자리)로 흐린다.
 */
export class OpenOrderResult {
  id: string;
  storeDelivery: OpenStoreDeliveryResult;
  /** 가게 (예: 강남구 역삼동) */
  pickupArea: string;
  pickupLatitude: number;
  pickupLongitude: number;
  /** 손님 (예: 강남구 대치동) */
  dropoffArea: string;
  dropoffLatitude: number;
  dropoffLongitude: number;
  distanceKm: number;
  durationMinutes: number;
  /** 배달대행료 */
  fare: number;
  /** 수락하면 라이더가 받는 금액 — 대행료에서 수수료를 뺀 값 */
  earning: number;
  requestedAt: Date;
  /** 내 위치에서 가게까지의 직선 거리(km). 내 위치를 보낸 적이 없으면 null. */
  distanceFromMeKm: number | null;
}

/** 콜 목록 응답. */
export class OpenOrderPageResult {
  items: OpenOrderResult[];
  total: number;
  page: number;
  size: number;
  /**
   * 가게가 내 위치에서 이 거리(km) 안인 배달만, 가까운 순으로 보여 준다.
   * null이면 최근 위치를 모르는 것이라 대기 중인 배달 전부를 최근 요청순으로 보여 준다.
   */
  radiusKm: number | null;
}

/** 라이더의 현재 위치 */
export class DriverLocationResult {
  latitude: number;
  longitude: number;
  /** 위치를 보낸 시각 */
  updatedAt: Date;
}

/** 배달 추적 응답. 가게가 진행 중인 배달의 라이더 위치와 도착 예정을 본다. */
export class TrackingResult {
  status: OrderStatus;
  /** 라이더 위치. 진행 중이 아니거나 라이더가 위치를 보낸 적이 없으면 null. */
  driverLocation: DriverLocationResult | null;
  estimatedPickupAt: Date | null;
  estimatedDeliveryAt: Date | null;
}

/** 하루치 수입 */
export class DailyEarningsResult {
  /** 한국 날짜 (YYYY-MM-DD) */
  date: string;
  /** 그날 받는 금액(원) — 대행료에서 수수료를 빼고 취소 보상을 더한 값 */
  earnings: number;
  /** 그날 완료한 배달의 대행료 합 (수수료를 빼기 전) */
  sales: number;
  completedCount: number;
}

/** 다음 정산 */
export class SettlementPreviewResult {
  /** 지급 예정일 (한국 날짜) */
  date: string;
  /** 그날 받을 금액 */
  amount: number;
}

/** 라이더 수입 응답. */
export class EarningsResult {
  from: string;
  to: string;
  totalEarnings: number;
  /** 대행료 합 (수수료를 빼기 전) */
  totalSales: number;
  completedCount: number;
  /** 배차된 뒤 가게가 취소한 건수 (취소 보상만 수입에 들어간다) */
  cancelledCount: number;
  /** 기간의 모든 날짜가 순서대로 온다 (수입이 없는 날은 0) */
  daily: DailyEarningsResult[];
  nextSettlement: SettlementPreviewResult;
}

/** 최근 배달한 주소 (손님) */
export class RecentDestinationResult {
  address: string;
  detailAddress: string | null;
  sigungu: string | null;
  dong: string | null;
  latitude: number;
  longitude: number;
  contactName: string;
  contactPhone: string;
  lastUsedAt: Date;
}

export function toWaypointResult(waypoint: Waypoint): WaypointResult {
  return {
    address: waypoint.address,
    detailAddress: waypoint.detailAddress,
    sigungu: waypoint.sigungu,
    dong: waypoint.dong,
    latitude: waypoint.point.latitude,
    longitude: waypoint.point.longitude,
    contactName: waypoint.contactName,
    contactPhone: waypoint.contactPhone.value,
  };
}

export function toOrderResult(order: Order): OrderResult {
  const state = order.snapshot();
  return {
    id: state.id,
    code: order.code,
    customerId: state.customerId,
    status: state.status,
    storeDelivery: { ...state.storeDelivery },
    pickup: toWaypointResult(state.pickup),
    dropoff: toWaypointResult(state.dropoff),
    memo: state.memo,
    distanceKm: state.distanceKm,
    durationMinutes: state.durationMinutes,
    fare: state.fare.amount,
    cancellationFee: state.cancellationFee.amount,
    cancellationFeeNow: order.cancellationFeeNow(),
    driverId: state.driverId,
    estimatedPickupAt: state.estimatedPickupAt,
    estimatedDeliveryAt: order.estimatedDeliveryAt,
    requestedAt: state.requestedAt,
    assignedAt: state.assignedAt,
    departedAt: state.departedAt,
    arrivedAt: state.arrivedAt,
    pickedUpAt: state.pickedUpAt,
    deliveredAt: state.deliveredAt,
    cancelledAt: state.cancelledAt,
    cancelReason: state.cancelReason,
  };
}

export function toDriverOrderResult(
  order: Order,
  policy: SettlementPolicy,
): DriverOrderResult {
  return { ...toOrderResult(order), earning: driverEarningOf(order, policy) };
}

/** 라이더가 이 배달로 받는 금액. 취소면 취소 보상, 아니면 대행료에서 수수료를 뺀 값. */
export function driverEarningOf(
  order: Order,
  policy: SettlementPolicy,
): number {
  const state = order.snapshot();
  if (state.status === OrderStatus.CANCELLED) {
    return policy.compensationOf(state.cancellationFee.amount);
  }
  return policy.earningOf(order.fare);
}

export function toOrderDetailResult(
  order: Order,
  driver: DispatchDriver | null,
): OrderDetailResult {
  return {
    ...toOrderResult(order),
    driver: driver && {
      id: driver.id,
      name: driver.name,
      phone: driver.phone,
      vehicleType: driver.vehicleType,
      vehicleNumber: driver.vehicleNumber,
    },
  };
}

export function toOpenOrderResult(
  order: Order,
  driverPoint: GeoPoint | null,
  policy: SettlementPolicy,
): OpenOrderResult {
  const state = order.snapshot();
  return {
    id: state.id,
    storeDelivery: {
      storeName: state.pickup.contactName,
      source: state.storeDelivery.source,
      foodAmount: state.storeDelivery.foodAmount,
      doorPayment: state.storeDelivery.doorPayment,
      readyAt: state.storeDelivery.readyAt,
    },
    pickupArea: state.pickup.area,
    pickupLatitude: coarse(state.pickup.point.latitude),
    pickupLongitude: coarse(state.pickup.point.longitude),
    dropoffArea: state.dropoff.area,
    dropoffLatitude: coarse(state.dropoff.point.latitude),
    dropoffLongitude: coarse(state.dropoff.point.longitude),
    distanceKm: state.distanceKm,
    durationMinutes: state.durationMinutes,
    fare: state.fare.amount,
    earning: policy.earningOf(state.fare.amount),
    requestedAt: state.requestedAt,
    distanceFromMeKm: driverPoint
      ? Math.round(driverPoint.straightDistanceKmTo(state.pickup.point) * 10) /
        10
      : null,
  };
}

/** 좌표를 소수 둘째 자리(약 1km)로 흐린다. */
function coarse(degrees: number): number {
  return Math.round(degrees * 100) / 100;
}
