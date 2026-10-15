import {
  ServiceType,
  VehicleType,
} from '../../../../common/domain/vehicle-type.js';
import { OrderMessage } from '../../domain/entities/order-message.entity.js';
import { Order } from '../../domain/entities/order.entity.js';
import { Review, ReviewTag } from '../../domain/entities/review.entity.js';
import { OrderStatus } from '../../domain/order-status.js';
import { DriverRating } from '../../domain/repositories/review.repository.js';
import {
  ChargePolicy,
  LoadingHelp,
} from '../../domain/services/charge-policy.js';
import { SettlementPolicy } from '../../domain/services/settlement-policy.js';
import {
  ChargeKind,
  ChargeStatus,
} from '../../../payment/domain/entities/order-charge.entity.js';
import { CardType } from '../../../payment/domain/entities/payment-method.entity.js';
import {
  failureGuide,
  PaymentFailureCode,
} from '../../../payment/domain/payment-failure.js';
import { CargoCategory } from '../../domain/value-objects/cargo.js';
import { GeoPoint } from '../../domain/value-objects/geo-point.js';
import { Waypoint } from '../../domain/value-objects/waypoint.js';
import { DispatchDriver } from '../ports/driver-directory.port.js';
import {
  ChargeRecord,
  PaymentCard,
  PaymentHistory,
} from '../ports/order-payments.port.js';

/** 좌표 */
export class CoordinatesResult {
  latitude: number;
  longitude: number;
}

/** 픽업지·도착지 */
export class WaypointResult {
  address: string;
  detailAddress: string | null;
  /** 시·군·구 (예: 성동구) */
  sigungu: string | null;
  /** 읍·면·동 (예: 성수동2가) */
  dong: string | null;
  latitude: number;
  longitude: number;
  contactName: string;
  contactPhone: string;
}

/** 화물 */
export class CargoResult {
  category: CargoCategory;
  /** 전체 중량(kg) */
  weightKg: number;
  quantity: number;
  description: string | null;
}

/** 층과 엘리베이터 */
export class FloorAccessResult {
  floor: number;
  elevator: boolean;
}

/** 기사가 픽업지에서 넣은 추가 요금의 수량 */
export class ExtraItemsResult {
  /** 과적 단계 */
  overload: number;
  /** 큰 짐 개수 */
  bulky: number;
  /** 엘리베이터 없이 오른 층 */
  stairs: number;
}

/** 배차 때 결제가 안 된 사유와 해결 방법 */
export class PaymentFailureResult {
  code: PaymentFailureCode;
  /** 예: 한도 초과 */
  title: string;
  /** 고객에게 보여 줄 해결 방법 */
  guidance: string;
}

/** 주문 응답. 고객 본인과 배차된 기사에게만 내려간다(연락처 포함). */
export class OrderResult {
  id: string;
  /** 주문번호 (예: MV261013-3F9A) */
  code: string;
  customerId: string;
  status: OrderStatus;
  serviceType: ServiceType;
  vehicleType: VehicleType;
  pickup: WaypointResult;
  dropoff: WaypointResult;
  cargo: CargoResult;
  /** 요청 사항 */
  memo: string | null;
  /** 운행 거리(km) */
  distanceKm: number;
  /** 픽업지에서 도착지까지 예상 소요 시간(분) */
  durationMinutes: number;
  /** 기본 요금(원) — 차종과 거리로 정한다 */
  baseFare: number;
  /** 고객이 고른 큰 짐 운반 도움 */
  loadingHelp: LoadingHelp;
  helpFee: number;
  pickupAccess: FloorAccessResult;
  dropoffAccess: FloorAccessResult;
  /** 엘리베이터 없는 층의 계단 요금 */
  stairFee: number;
  /** 배차될 때 결제하는 요금(원) = 기본 요금 + 운반 도움 + 계단 */
  fare: number;
  /** 기사가 픽업할 때 넣은 추가 요금 */
  extraItems: ExtraItemsResult;
  extraFee: number;
  /** 기사가 도착한 뒤 픽업까지 기다린 시간(분)과 대기료 */
  waitingMinutes: number;
  waitingFee: number;
  /** 최종 요금 = 배차 때 결제한 요금 + 추가 요금 + 대기료 */
  totalFare: number;
  /** 취소 수수료 또는 노쇼 요금. 없으면 0. */
  cancellationFee: number;
  /** 지금 취소하면 붙는 수수료. 취소할 수 없는 상태면 null. */
  cancellationFeeNow: number | null;
  /** 노쇼를 신고할 수 있게 되는 시각. 기사가 도착한 주문만. */
  noShowAvailableAt: Date | null;
  /** 배차 때 결제가 안 된 사유. PAYMENT_FAILED일 때만. */
  paymentFailure: PaymentFailureResult | null;
  /** 배차된 기사 ID. 배차 전에는 null. */
  driverId: string | null;
  /** 예약 픽업 시각. null이면 바로 픽업. */
  scheduledPickupAt: Date | null;
  /** 픽업 예정 시각 (배차될 때 기사 위치로 어림). 모르면 null. */
  estimatedPickupAt: Date | null;
  /** 도착 예정 시각. 어림할 수 없거나 이미 끝난 주문이면 null. */
  estimatedDeliveryAt: Date | null;
  requestedAt: Date;
  assignedAt: Date | null;
  /** 기사가 픽업지로 출발한 시각 */
  departedAt: Date | null;
  /** 기사가 픽업지에 도착한 시각 */
  arrivedAt: Date | null;
  pickedUpAt: Date | null;
  deliveredAt: Date | null;
  cancelledAt: Date | null;
  /** 노쇼로 처리된 시각 */
  noShowAt: Date | null;
  cancelReason: string | null;
}

/** 결제 상태 */
export enum OrderPaymentStatus {
  /** 아직 결제하지 않았다 (배차 전) */
  UNPAID = 'UNPAID',
  PAID = 'PAID',
  /** 배차 때 결제가 안 됐다 */
  FAILED = 'FAILED',
  PARTIALLY_REFUNDED = 'PARTIALLY_REFUNDED',
  REFUNDED = 'REFUNDED',
}

/** 결제한(할) 카드 */
export class PaymentCardResult {
  /** 카드사 (예: 신한카드) */
  brand: string;
  last4: string;
  type: CardType;
}

/** 카드 결제 한 건 */
export class ChargeResult {
  id: string;
  /** DISPATCH: 배차 때 결제 / ADDITIONAL: 픽업 때 추가 결제 */
  kind: ChargeKind;
  amount: number;
  status: ChargeStatus;
  card: PaymentCardResult;
  approvalNumber: string | null;
  approvedAt: Date | null;
  failure: PaymentFailureResult | null;
  failedAt: Date | null;
  /** 돌려준 금액 */
  cancelledAmount: number;
  cancelledAt: Date | null;
}

/** 돌려준 한 건 */
export class RefundResult {
  amount: number;
  reason: string;
  /** 고객 취소로 자동 환불했는지 (아니면 운영자가 돌려줬다) */
  automatic: boolean;
  refundedAt: Date;
}

/** 주문의 결제 정보 */
export class OrderPaymentResult {
  status: OrderPaymentStatus;
  /** 결제한 카드. 결제 전이면 결제할 카드. 카드가 없으면 null. */
  card: PaymentCardResult | null;
  /** 결제한 금액의 합 (돌려준 금액을 빼기 전) */
  paidAmount: number;
  refundedAmount: number;
  /** 결제가 안 된 추가 요금 (픽업 때 추가 결제가 실패한 경우) */
  unpaidAmount: number;
  /** 배차 때 결제한 시각 */
  paidAt: Date | null;
  /** 추가 요금을 결제한 시각 */
  additionalPaidAt: Date | null;
  /** 마지막으로 돌려준 시각 */
  refundedAt: Date | null;
  charges: ChargeResult[];
  refunds: RefundResult[];
}

/** 고객의 주문 목록 한 줄. 배차된 기사 이름과 결제 정보가 붙는다. */
export class OrderListItemResult extends OrderResult {
  /** 배차된 기사 이름. 배차 전에는 null. */
  driverName: string | null;
  payment: OrderPaymentResult;
}

/** 영수증 (앱 안에서 보는 카드 매출전표) */
export class ReceiptResult {
  orderId: string;
  code: string;
  status: OrderStatus;
  /** 결제한 금액의 합 */
  paidAmount: number;
  /** 공급가액·부가세 — 결제한 금액에 부가세 10%가 들어 있다고 보고 나눈다 */
  supplyAmount: number;
  vat: number;
  refundedAmount: number;
  /** 최종 결제 금액 = 결제한 금액 − 돌려준 금액 */
  finalAmount: number;
  cancellationFee: number;
  card: PaymentCardResult | null;
  /** 승인된 결제의 승인번호 (결제한 순서) */
  approvalNumbers: string[];
  paidAt: Date | null;
  additionalPaidAt: Date | null;
  refundedAt: Date | null;
}

/** 배차된 기사 */
export class AssignedDriverResult {
  id: string;
  name: string;
  phone: string;
  vehicleType: VehicleType;
  vehicleNumber: string;
  /** 평균 별점 (1~5, 소수 첫째 자리). 받은 평가가 없으면 null. */
  rating: number | null;
  reviewCount: number;
}

/** 고객이 남긴 평가 */
export class ReviewResult {
  /** 별점 1~5 */
  rating: number;
  tags: ReviewTag[];
  comment: string | null;
  createdAt: Date;
}

/** 주문 상세 응답. 배차된 기사와 평가, 결제 정보가 붙는다. */
export class OrderDetailResult extends OrderResult {
  /** 결제 정보. 기사가 볼 때는 null. */
  payment: OrderPaymentResult | null;
  /** 배차된 기사. 배차 전에는 null. */
  driver: AssignedDriverResult | null;
  /** 이 주문에 남긴 평가. 아직 없으면 null. */
  review: ReviewResult | null;
}

/** 고객의 주문 목록 응답. */
export class OrderListResult {
  items: OrderListItemResult[];
  total: number;
  page: number;
  size: number;
}

/** 기사가 보는 주문. 이 배송으로 받는 금액이 붙는다. */
export class DriverOrderResult extends OrderResult {
  /**
   * 기사가 받는 금액(원). 배송은 최종 요금에서 수수료를 뺀 값,
   * 고객이 취소했거나 노쇼면 취소 보상(지금 정책은 0원).
   */
  earning: number;
}

/** 기사의 배송 목록 응답. */
export class OrderPageResult {
  items: DriverOrderResult[];
  total: number;
  page: number;
  size: number;
}

/**
 * 배차 대기 주문 응답. 아직 수락하지 않은 기사에게 보이므로 위치는 동 단위까지만 주고
 * 상세 주소·연락처·요청 사항은 뺀다. 좌표도 약 1km 단위로 흐려서 준다 — 정확한 좌표는
 * 주소와 다름없기 때문이다. 지도에 대략의 위치를 찍는 데 쓴다.
 */
export class OpenOrderResult {
  id: string;
  serviceType: ServiceType;
  vehicleType: VehicleType;
  /** 픽업지 (예: 성동구 성수동2가) */
  pickupArea: string;
  pickupLatitude: number;
  pickupLongitude: number;
  /** 도착지 (예: 강남구 역삼동) */
  dropoffArea: string;
  dropoffLatitude: number;
  dropoffLongitude: number;
  cargo: CargoResult;
  distanceKm: number;
  durationMinutes: number;
  baseFare: number;
  loadingHelp: LoadingHelp;
  helpFee: number;
  pickupAccess: FloorAccessResult;
  dropoffAccess: FloorAccessResult;
  stairFee: number;
  /** 배차될 때 결제하는 요금 = 기본 요금 + 운반 도움 + 계단 */
  fare: number;
  scheduledPickupAt: Date | null;
  requestedAt: Date;
  /** 내 위치에서 픽업지까지의 직선 거리(km). 내 위치를 보낸 적이 없으면 null. */
  distanceFromMeKm: number | null;
}

/** 배차 대기 주문 목록 응답. */
export class OpenOrderPageResult {
  items: OpenOrderResult[];
  total: number;
  page: number;
  size: number;
  /**
   * 픽업지가 내 위치에서 이 거리(km) 안인 주문만, 가까운 순으로 보여 준다.
   * null이면 최근 위치를 모르는 것이라 내 차종의 대기 주문 전부를 최근 요청순으로 보여 준다.
   */
  radiusKm: number | null;
}

/** 차종 하나의 견적 */
export class FareOptionResult {
  vehicleType: VehicleType;
  label: string;
  serviceType: ServiceType;
  capacityHint: string;
  maxLoadKg: number;
  /** 예상 요금(원) */
  fare: number;
}

/** 요금에 붙는 것들의 규칙. 앱이 견적·안내·취소 규정 화면에 그대로 쓴다. */
export class ChargePolicyResult {
  /** 큰 짐 운반 도움 요금 */
  helpFees: Record<LoadingHelp, number>;
  /** 엘리베이터가 없을 때 2층부터 한 층에 붙는 계단 요금 */
  stairFeePerFloor: number;
  /** 기사가 픽업할 때 넣는 추가 요금의 단가 */
  extraUnitPrices: ExtraItemsResult;
  /** 기사가 도착한 뒤 무료로 기다리는 시간(분) */
  freeWaitingMinutes: number;
  /** 무료 시간이 지난 뒤 1분마다 붙는 대기료 */
  waitingFeePerMinute: number;
  /** 기사가 출발한 뒤 취소할 때의 수수료율(%) */
  cancellationFeePercent: number;
  /** 기사가 도착하고 노쇼를 신고할 수 있게 되기까지(분). 노쇼면 요금 전액을 받는다. */
  noShowWaitMinutes: number;
}

export function toChargePolicyResult(): ChargePolicyResult {
  const rules = ChargePolicy.rules;
  return {
    helpFees: { ...rules.helpFee },
    stairFeePerFloor: rules.stairFeePerFloor,
    extraUnitPrices: { ...rules.extraUnitPrice },
    freeWaitingMinutes: rules.freeWaitingMinutes,
    waitingFeePerMinute: rules.waitingFeePerMinute,
    cancellationFeePercent: rules.cancellationFeePercent,
    noShowWaitMinutes: rules.noShowWaitMinutes,
  };
}

/** 요금 견적 응답. 한 번에 차종별 요금을 모두 준다. */
export class FareEstimatesResult {
  /** 운행 거리(km) */
  distanceKm: number;
  /** 예상 소요 시간(분) */
  durationMinutes: number;
  /** 지도에 그릴 경로 (출발 → 도착 순) */
  route: CoordinatesResult[];
  options: FareOptionResult[];
}

/** 차종 안내 응답. */
export class VehicleTypeResult {
  type: VehicleType;
  /** 화면에 보여줄 이름 */
  label: string;
  serviceType: ServiceType;
  /** 무엇을 싣기 좋은지 한 줄로 */
  capacityHint: string;
  /** 최대 적재 중량(kg) */
  maxLoadKg: number;
}

/** 기사의 현재 위치 */
export class DriverLocationResult {
  latitude: number;
  longitude: number;
  /** 기사 앱이 이 위치를 보낸 시각 */
  updatedAt: Date;
}

/** 배송 추적 응답. 고객이 진행 중인 주문의 기사 위치와 도착 예정을 본다. */
export class TrackingResult {
  status: OrderStatus;
  /** 기사 위치. 진행 중이 아니거나 기사가 위치를 보낸 적이 없으면 null. */
  driverLocation: DriverLocationResult | null;
  estimatedPickupAt: Date | null;
  estimatedDeliveryAt: Date | null;
}

/** 길안내 응답. 기사가 다음에 갈 곳까지의 경로다. */
export class NavigationResult {
  /** 지금 향하는 곳: 픽업 전이면 PICKUP, 픽업한 뒤면 DROPOFF */
  target: 'PICKUP' | 'DROPOFF';
  address: string;
  latitude: number;
  longitude: number;
  distanceKm: number;
  durationMinutes: number;
  route: CoordinatesResult[];
}

/** 주문 메시지 */
export class MessageResult {
  id: string;
  /** 내가 보낸 메시지인지 */
  mine: boolean;
  text: string;
  createdAt: Date;
}

/** 하루치 수입 */
export class DailyEarningsResult {
  /** 한국 날짜 (YYYY-MM-DD) */
  date: string;
  /** 받는 금액 — 매출에서 수수료를 빼고 취소 보상을 더한 값 */
  earnings: number;
  /** 매출 — 완료한 배송의 최종 요금과 취소 보상의 합 (수수료를 빼기 전) */
  sales: number;
  completedCount: number;
}

/** 다음 정산 */
export class SettlementPreviewResult {
  /** 입금일 (한국 날짜, YYYY-MM-DD) */
  date: string;
  /** 입금 예정 금액(원) */
  amount: number;
}

/** 기사 수입 응답. */
export class EarningsResult {
  from: string;
  to: string;
  totalEarnings: number;
  /** 매출 합 (수수료를 빼기 전) */
  totalSales: number;
  completedCount: number;
  /** 배차된 뒤 고객이 취소한 건수 (취소 보상만 수입에 들어간다) */
  cancelledCount: number;
  /** 노쇼로 끝난 건수 */
  noShowCount: number;
  /** 기간의 모든 날짜가 순서대로 온다 (수입이 없는 날은 0) */
  daily: DailyEarningsResult[];
  nextSettlement: SettlementPreviewResult;
}

/** 최근 보낸 곳 */
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

export function toCoordinates(point: GeoPoint): CoordinatesResult {
  return { latitude: point.latitude, longitude: point.longitude };
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
    serviceType: state.serviceType,
    vehicleType: state.vehicleType,
    pickup: toWaypointResult(state.pickup),
    dropoff: toWaypointResult(state.dropoff),
    cargo: { ...state.cargo },
    memo: state.memo,
    distanceKm: state.distanceKm,
    durationMinutes: state.durationMinutes,
    baseFare: state.baseFare.amount,
    loadingHelp: state.loadingHelp,
    helpFee: state.helpFee.amount,
    pickupAccess: { ...state.pickupAccess },
    dropoffAccess: { ...state.dropoffAccess },
    stairFee: state.stairFee.amount,
    fare: state.fare.amount,
    extraItems: { ...state.extraItems },
    extraFee: state.extraFee.amount,
    waitingMinutes: state.waitingMinutes,
    waitingFee: state.waitingFee.amount,
    totalFare: order.totalFare,
    cancellationFee: state.cancellationFee.amount,
    cancellationFeeNow: order.cancellationFeeNow(),
    noShowAvailableAt:
      state.status === OrderStatus.ARRIVED && state.arrivedAt
        ? ChargePolicy.noShowAvailableAt(state.arrivedAt)
        : null,
    paymentFailure:
      state.status === OrderStatus.PAYMENT_FAILED
        ? failureGuide(state.paymentFailureCode)
        : null,
    driverId: state.driverId,
    scheduledPickupAt: state.scheduledPickupAt,
    estimatedPickupAt: state.estimatedPickupAt,
    estimatedDeliveryAt: order.estimatedDeliveryAt,
    requestedAt: state.requestedAt,
    assignedAt: state.assignedAt,
    departedAt: state.departedAt,
    arrivedAt: state.arrivedAt,
    pickedUpAt: state.pickedUpAt,
    deliveredAt: state.deliveredAt,
    cancelledAt: state.cancelledAt,
    noShowAt: state.noShowAt,
    cancelReason: state.cancelReason,
  };
}

function toCardResult(card: PaymentCard): PaymentCardResult {
  return { brand: card.brand, last4: card.last4, type: card.type };
}

function toChargeResult(charge: ChargeRecord): ChargeResult {
  return {
    id: charge.id,
    kind: charge.kind,
    amount: charge.amount,
    status: charge.status,
    card: toCardResult(charge.card),
    approvalNumber: charge.approvalNumber,
    approvedAt: charge.approvedAt,
    failure: failureGuide(charge.failureCode),
    failedAt: charge.failedAt,
    cancelledAmount: charge.cancelledAmount,
    cancelledAt: charge.cancelledAt,
  };
}

const PAID_STATUSES: readonly ChargeStatus[] = [
  ChargeStatus.PAID,
  ChargeStatus.PARTIALLY_CANCELLED,
  ChargeStatus.CANCELLED,
];

/**
 * 주문의 결제 정보. [history]는 그 주문의 결제·환불 기록,
 * [selectedCard]는 아직 결제하기 전에 보여 줄, 고객이 고른 카드다.
 */
export function toOrderPaymentResult(
  order: Order,
  history: PaymentHistory,
  selectedCard: PaymentCard | null = null,
): OrderPaymentResult {
  const { charges, refunds } = history;
  const paid = charges.filter((charge) =>
    PAID_STATUSES.includes(charge.status),
  );
  const paidAmount = paid.reduce((sum, charge) => sum + charge.amount, 0);
  const refundedAmount = paid.reduce(
    (sum, charge) => sum + charge.cancelledAmount,
    0,
  );
  const dispatch = paid.find((charge) => charge.kind === ChargeKind.DISPATCH);
  const additional = paid.find(
    (charge) => charge.kind === ChargeKind.ADDITIONAL,
  );
  const refundedAt = refunds.at(-1)?.refundedAt;
  const pickedUp =
    order.status === OrderStatus.PICKED_UP ||
    order.status === OrderStatus.DELIVERED;
  let status: OrderPaymentStatus;
  if (paidAmount === 0) {
    status =
      order.status === OrderStatus.PAYMENT_FAILED
        ? OrderPaymentStatus.FAILED
        : OrderPaymentStatus.UNPAID;
  } else if (refundedAmount === 0) {
    status = OrderPaymentStatus.PAID;
  } else {
    status =
      refundedAmount === paidAmount
        ? OrderPaymentStatus.REFUNDED
        : OrderPaymentStatus.PARTIALLY_REFUNDED;
  }
  const card = dispatch?.card ?? charges.at(-1)?.card ?? selectedCard;
  return {
    status,
    card: card ? toCardResult(card) : null,
    paidAmount,
    refundedAmount,
    unpaidAmount: pickedUp ? Math.max(0, order.totalFare - paidAmount) : 0,
    paidAt: dispatch?.approvedAt ?? null,
    additionalPaidAt: additional?.approvedAt ?? null,
    refundedAt: refundedAt ?? null,
    charges: charges.map(toChargeResult),
    refunds: refunds.map((refund) => ({
      amount: refund.amount,
      reason: refund.reason,
      automatic: refund.refundedBy === null,
      refundedAt: refund.refundedAt,
    })),
  };
}

/** 영수증. 결제한 금액에 부가세 10%가 들어 있다고 보고 공급가액과 부가세로 나눈다. */
export function toReceiptResult(
  order: Order,
  history: PaymentHistory,
): ReceiptResult {
  const payment = toOrderPaymentResult(order, history);
  const vat = Math.round(payment.paidAmount / 11);
  return {
    orderId: order.id,
    code: order.code,
    status: order.status,
    paidAmount: payment.paidAmount,
    supplyAmount: payment.paidAmount - vat,
    vat,
    refundedAmount: payment.refundedAmount,
    finalAmount: payment.paidAmount - payment.refundedAmount,
    cancellationFee: order.snapshot().cancellationFee.amount,
    card: payment.card,
    approvalNumbers: history.charges
      .filter((charge) => PAID_STATUSES.includes(charge.status))
      .map((charge) => charge.approvalNumber)
      .filter((number): number is string => number !== null),
    paidAt: payment.paidAt,
    additionalPaidAt: payment.additionalPaidAt,
    refundedAt: payment.refundedAt,
  };
}

export function toDriverOrderResult(
  order: Order,
  policy: SettlementPolicy,
): DriverOrderResult {
  return { ...toOrderResult(order), earning: driverEarningOf(order, policy) };
}

/** 기사가 이 주문으로 받는 금액. 취소·노쇼면 취소 보상, 아니면 최종 요금에서 수수료를 뺀 값. */
export function driverEarningOf(
  order: Order,
  policy: SettlementPolicy,
): number {
  const state = order.snapshot();
  if (
    state.status === OrderStatus.CANCELLED ||
    state.status === OrderStatus.NO_SHOW
  ) {
    return policy.compensationOf(state.cancellationFee.amount);
  }
  return policy.earningOf(order.totalFare);
}

export function toReviewResult(review: Review): ReviewResult {
  return {
    rating: review.rating,
    tags: review.tags,
    comment: review.comment,
    createdAt: review.createdAt,
  };
}

export function toOrderDetailResult(
  order: Order,
  driver: DispatchDriver | null,
  rating: DriverRating,
  review: Review | null,
  payment: OrderPaymentResult | null,
): OrderDetailResult {
  return {
    ...toOrderResult(order),
    payment,
    driver: driver && {
      id: driver.id,
      name: driver.name,
      phone: driver.phone,
      vehicleType: driver.vehicleType,
      vehicleNumber: driver.vehicleNumber,
      rating: rating.average,
      reviewCount: rating.count,
    },
    review: review && toReviewResult(review),
  };
}

export function toOpenOrderResult(
  order: Order,
  driverPoint: GeoPoint | null,
): OpenOrderResult {
  const state = order.snapshot();
  return {
    id: state.id,
    serviceType: state.serviceType,
    vehicleType: state.vehicleType,
    pickupArea: state.pickup.area,
    pickupLatitude: coarse(state.pickup.point.latitude),
    pickupLongitude: coarse(state.pickup.point.longitude),
    dropoffArea: state.dropoff.area,
    dropoffLatitude: coarse(state.dropoff.point.latitude),
    dropoffLongitude: coarse(state.dropoff.point.longitude),
    cargo: { ...state.cargo },
    distanceKm: state.distanceKm,
    durationMinutes: state.durationMinutes,
    baseFare: state.baseFare.amount,
    loadingHelp: state.loadingHelp,
    helpFee: state.helpFee.amount,
    pickupAccess: { ...state.pickupAccess },
    dropoffAccess: { ...state.dropoffAccess },
    stairFee: state.stairFee.amount,
    fare: state.fare.amount,
    scheduledPickupAt: state.scheduledPickupAt,
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

export function toMessageResult(
  message: OrderMessage,
  viewerUserId: string,
): MessageResult {
  return {
    id: message.id,
    mine: message.senderUserId === viewerUserId,
    text: message.text,
    createdAt: message.createdAt,
  };
}
