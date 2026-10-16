import { OrderStatus } from '../../../order/domain/order-status.js';
import { ConsumerAddress } from '../../domain/entities/consumer-address.entity.js';
import {
  FoodOrderCanceller,
  FoodOrderDestination,
  FoodOrderStatus,
  RefundBearer,
} from '../../domain/entities/food-order.entity.js';
import { MenuOptionGroup } from '../../domain/entities/menu.entity.js';
import {
  ClosedReason,
  FoodCategory,
  StorefrontSettings,
} from '../../domain/entities/storefront.entity.js';
import { FoodOrderLine } from '../../domain/services/cart-pricing.js';
import { StoreSettlementEntryKind } from '../../domain/services/store-settlement.js';
import { CheckoutInfo } from '../ports/payment-gateway.port.js';

/** 사장님이 보는 내 가게 운영 설정. */
export class MyStorefrontResult {
  storeId: string;
  storeName: string;
  /** 가게 심사가 끝났는지 (끝나야 손님 앱에 보인다) */
  approved: boolean;
  settings: StorefrontSettings;
  /** 대표 사진 주소 (/api부터). 없으면 null. */
  logoUrl: string | null;
  open: boolean;
  pausedUntil: Date | null;
  hidden: boolean;
  hiddenReason: string | null;
  /** 지금 손님이 주문할 수 없는 이유. 받을 수 있으면 null. */
  closedReason: ClosedReason | null;
  /** 손님에게 보이는 메뉴 수 */
  visibleMenuCount: number;
}

export class MenuItemResult {
  id: string;
  categoryId: string;
  name: string;
  description: string | null;
  price: number;
  sortOrder: number;
  hidden: boolean;
  soldOut: boolean;
  photoUrl: string | null;
  optionGroups: MenuOptionGroup[];
}

export class MenuCategoryResult {
  id: string;
  name: string;
  sortOrder: number;
  items: MenuItemResult[];
}

/** 손님 앱 가게 목록의 카드. */
export class StorefrontCardResult {
  storeId: string;
  name: string;
  category: FoodCategory;
  logoUrl: string | null;
  /** 손님 주소에서의 직선 거리 (km) */
  distanceKm: number;
  minOrderAmount: number;
  /** 가장 적게 내는 배달팁 ~ 가장 많이 내는 배달팁 (이 거리 기준) */
  deliveryTipMin: number;
  deliveryTipMax: number;
  /** 예상 도착 (분) 범위 */
  estimatedMinutes: { min: number; max: number };
  rating: number | null;
  reviewCount: number;
  /** 지금 주문할 수 없는 이유. 받을 수 있으면 null. */
  closedReason: ClosedReason | null;
}

export class StorefrontDetailResult {
  storeId: string;
  name: string;
  phone: string;
  address: string;
  category: FoodCategory;
  description: string | null;
  originNotice: string | null;
  logoUrl: string | null;
  minOrderAmount: number;
  maxDeliveryKm: number;
  deliveryTipRules: StorefrontSettings['deliveryTipRules'];
  distanceTipRules: StorefrontSettings['distanceTipRules'];
  businessHours: StorefrontSettings['businessHours'];
  holidays: string[];
  closedReason: ClosedReason | null;
  pausedUntil: Date | null;
  rating: number | null;
  reviewCount: number;
  /** 손님 주소를 함께 보냈으면: 거리, 배달 가능 여부, 이 주소의 배달팁(최소주문 기준) */
  delivery: {
    distanceKm: number;
    deliverable: boolean;
    deliveryTip: number;
    estimatedMinutes: { min: number; max: number };
  } | null;
  menu: MenuCategoryResult[];
}

export class ReviewResult {
  id: string;
  foodOrderId: string;
  authorName: string;
  rating: number;
  content: string | null;
  /** 시킨 메뉴 요약 */
  orderSummary: string;
  createdAt: Date;
}

export type ConsumerAddressResult = Omit<ConsumerAddress, 'userId'>;

/** 결제 전 금액 확인. */
export class FoodOrderQuoteResult {
  storeId: string;
  storeName: string;
  lines: FoodOrderLine[];
  menuAmount: number;
  deliveryTip: number;
  paymentAmount: number;
  distanceKm: number;
  minOrderAmount: number;
  /** 최소 주문 금액까지 남은 금액 (넘었으면 0) */
  shortOfMinOrder: number;
  deliverable: boolean;
  closedReason: ClosedReason | null;
  /** 주문할 수 없는 이유 (주문할 수 있으면 null): CLOSED | TOO_FAR | BELOW_MIN_ORDER */
  blocker: 'CLOSED' | 'TOO_FAR' | 'BELOW_MIN_ORDER' | null;
}

export class FoodOrderRefundResult {
  id: string;
  amount: number;
  reason: string;
  borneBy: RefundBearer | null;
  /** PENDING(돌려주는 중) | DONE | FAILED(운영자가 다시 시도) */
  status: string;
  refundedAt: Date;
}

/** 주문에 딸린 배달의 지금 상태. */
export class FoodOrderDeliveryResult {
  deliveryId: string;
  status: OrderStatus;
  driverName: string | null;
  estimatedPickupAt: Date | null;
  estimatedDeliveryAt: Date | null;
  assignedAt: Date | null;
  pickedUpAt: Date | null;
  deliveredAt: Date | null;
}

export class FoodOrderSummaryResult {
  id: string;
  code: string;
  status: FoodOrderStatus;
  storeId: string;
  storeName: string;
  storeLogoUrl: string | null;
  summary: string;
  itemCount: number;
  paymentAmount: number;
  createdAt: Date;
  paidAt: Date | null;
  deliveredAt: Date | null;
  /** 리뷰를 썼는지 (손님 목록에서만, 나머지는 null) */
  reviewed: boolean | null;
}

export class FoodOrderDetailResult extends FoodOrderSummaryResult {
  consumerUserId: string;
  consumerPhone: string;
  storePhone: string | null;
  lines: FoodOrderLine[];
  menuAmount: number;
  deliveryTip: number;
  dropoff: FoodOrderDestination;
  distanceKm: number;
  storeRequest: string | null;
  riderRequest: string | null;
  disposableCutlery: boolean;
  paymentId: string;
  cookMinutes: number | null;
  acceptedAt: Date | null;
  pickedUpAt: Date | null;
  rejectedAt: Date | null;
  rejectReason: string | null;
  cancelledAt: Date | null;
  cancelReason: string | null;
  cancelledBy: FoodOrderCanceller | null;
  refunds: FoodOrderRefundResult[];
  /** 돌려줄 수 있는 남은 금액 */
  refundableAmount: number;
  delivery: FoodOrderDeliveryResult | null;
  /** 가게가 받을 금액 계산 (가게·운영자 화면만, 손님에게는 null) */
  settlement: {
    commissionRatePercent: number;
    paymentFeeRatePercent: number;
    commission: number;
    paymentFee: number;
  } | null;
}

/** 주문을 만들었다 — 이 값으로 결제창을 연다. */
export class PlacedFoodOrderResult {
  order: FoodOrderDetailResult;
  checkout: CheckoutInfo;
}

export class StoreSettlementEntryResult {
  id: string;
  foodOrderId: string;
  kind: StoreSettlementEntryKind;
  amount: number;
  menuAmount: number;
  deliveryTip: number;
  commission: number;
  paymentFee: number;
  deliveryFee: number;
  memo: string | null;
  payoutDueOn: string;
  paid: boolean;
  createdAt: Date;
}

export class StoreSettlementSummaryResult {
  /** 아직 지급하지 않은 정산 (지급 예정일별) */
  upcoming: { dueOn: string; amount: number; entryCount: number }[];
  upcomingTotal: number;
  /** 지금 정책의 정산 방식 */
  cycle: string;
  payoutWeekday: number;
  delayDays: number;
  commissionRatePercent: number;
  paymentFeeRatePercent: number;
  /** 운영자가 지급을 멈췄으면 그 사유 */
  holdReason: string | null;
}

export class StoreSettlementAccountResult {
  bankName: string;
  /** 끝 네 자리만 */
  maskedAccountNumber: string;
  accountHolder: string;
  /** 운영자가 확인했는지 — 확인해야 지급한다 */
  verified: boolean;
  verifiedAt: Date | null;
  updatedAt: Date;
}

export class StorePayoutResult {
  id: string;
  storeId: string;
  storeName: string | null;
  dueOn: string;
  amount: number;
  entryCount: number;
  bankName: string;
  maskedAccountNumber: string;
  accountHolder: string;
  paidAt: Date;
}

export class DueStoreSettlementResult {
  storeId: string;
  storeName: string;
  amount: number;
  entryCount: number;
  earliestDueOn: string;
  account: StoreSettlementAccountResult | null;
  holdReason: string | null;
  /** 지금 지급할 수 있는지 (계좌 확인됨, 보류 아님, 금액 > 0) */
  payable: boolean;
}

/** 운영자가 보는 가게의 주문앱 상태 (입점 검수). */
export class AdminStorefrontResult extends MyStorefrontResult {
  hiddenAt: Date | null;
  menu: MenuCategoryResult[];
}

export class Page<T> {
  items: T[];
  total: number;
  page: number;
  size: number;
}
