import { Paged, PageRequest } from '../../../../common/domain/pagination.js';
import { ConsumerAddress } from '../entities/consumer-address.entity.js';
import { FoodOrder, FoodOrderStatus } from '../entities/food-order.entity.js';
import { MenuCategory, MenuItem } from '../entities/menu.entity.js';
import { Review } from '../entities/review.entity.js';
import { Storefront } from '../entities/storefront.entity.js';
import {
  StorePayout,
  StoreSettlementAccount,
  StoreSettlementEntry,
  StoreSettlementHold,
} from '../services/store-settlement.js';

export const STOREFRONT_REPOSITORY = Symbol('STOREFRONT_REPOSITORY');
export const MENU_REPOSITORY = Symbol('MENU_REPOSITORY');
export const FOOD_ORDER_REPOSITORY = Symbol('FOOD_ORDER_REPOSITORY');
export const STORE_SETTLEMENT_REPOSITORY = Symbol(
  'STORE_SETTLEMENT_REPOSITORY',
);
export const REVIEW_REPOSITORY = Symbol('REVIEW_REPOSITORY');
export const CONSUMER_ADDRESS_REPOSITORY = Symbol(
  'CONSUMER_ADDRESS_REPOSITORY',
);

export interface StorefrontRepository {
  findByStoreId(storeId: string): Promise<Storefront | null>;
  findByStoreIds(storeIds: string[]): Promise<Storefront[]>;
  save(storefront: Storefront): Promise<void>;
}

export interface MenuRepository {
  /** 순서대로 */
  findCategories(storeId: string): Promise<MenuCategory[]>;
  findCategory(id: string): Promise<MenuCategory | null>;
  saveCategory(category: MenuCategory): Promise<void>;
  deleteCategory(id: string): Promise<void>;
  /** 카테고리 순서, 그 안의 순서대로 */
  findItems(storeId: string): Promise<MenuItem[]>;
  findItem(id: string): Promise<MenuItem | null>;
  saveItem(item: MenuItem): Promise<void>;
  deleteItem(id: string): Promise<void>;
  countItems(
    storeId: string,
    filter?: { categoryId?: string; visibleOnly?: boolean },
  ): Promise<number>;
}

export interface FoodOrderFilter {
  storeId?: string;
  consumerUserId?: string;
  statuses?: FoodOrderStatus[];
  /** 요청(만든) 시각 범위 [from, to) */
  from?: Date;
  to?: Date;
  /** 이 시각보다 먼저 결제했는데 아직 가게가 받지 않은 주문만 (접수 지연) */
  placedBefore?: Date;
  /** 결제한 주문만 (결제하지 않고 그만둔 주문은 가게·손님 목록에 보이지 않는다) */
  paidOnly?: boolean;
  /** 환불이 실패해 다시 시도해야 하는 주문만 */
  refundFailed?: boolean;
}

export interface FoodOrderRepository {
  save(order: FoodOrder): Promise<void>;
  findById(id: string): Promise<FoodOrder | null>;
  findByPaymentId(paymentId: string): Promise<FoodOrder | null>;
  findByDeliveryOrderId(deliveryOrderId: string): Promise<FoodOrder | null>;
  /** 최근 것부터 */
  find(filter: FoodOrderFilter, page: PageRequest): Promise<Paged<FoodOrder>>;
  /** 결제했고 아직 끝나지 않은 주문 수 (탈퇴 확인) */
  countUnfinishedByConsumer(userId: string): Promise<number>;
  /** 가게별 최근 배달 완료 주문 수 (주문 많은 순 정렬) */
  deliveredCounts(
    storeIds: string[],
    since: Date,
  ): Promise<Map<string, number>>;
}

/** 지급할 정산 한 가게분. */
export interface DueStoreSettlement {
  storeId: string;
  storeName: string;
  amount: number;
  entryCount: number;
  earliestDueOn: string;
}

export interface StoreSettlementRepository {
  addEntry(entry: StoreSettlementEntry): Promise<void>;
  /** 이 주문의 이 종류 내역이 이미 있는지 (배달 완료 이벤트가 두 번 와도 한 번만 쌓는다) */
  hasEntry(foodOrderId: string, kind: string): Promise<boolean>;
  /** 최근 것부터 */
  findEntries(
    storeId: string,
    filter: { from?: Date; to?: Date },
    page: PageRequest,
  ): Promise<Paged<StoreSettlementEntry>>;
  /** 아직 지급하지 않은 내역을 지급 예정일별로 모은 합 */
  unpaidByDueOn(
    storeId: string,
  ): Promise<{ dueOn: string; amount: number; entryCount: number }[]>;
  /** [asOf]까지 지급 예정인데 아직 지급하지 않은 정산을 가게별로 */
  due(asOf: string): Promise<DueStoreSettlement[]>;
  /** [asOf]까지 지급 예정인 내역을 지급 하나로 묶는다. 묶은 내역 수와 금액을 준다. */
  pay(
    payout: Omit<StorePayout, 'amount' | 'entryCount'>,
    asOf: string,
  ): Promise<StorePayout>;
  findPayouts(
    filter: { storeId?: string },
    page: PageRequest,
  ): Promise<Paged<StorePayout>>;
  findAccount(storeId: string): Promise<StoreSettlementAccount | null>;
  findAccounts(
    storeIds: string[],
  ): Promise<Map<string, StoreSettlementAccount>>;
  saveAccount(account: StoreSettlementAccount): Promise<void>;
  findHolds(storeIds: string[]): Promise<Map<string, StoreSettlementHold>>;
  saveHold(hold: StoreSettlementHold): Promise<void>;
  deleteHold(storeId: string): Promise<void>;
}

export interface ReviewRepository {
  /** 같은 주문에 이미 있으면 ConflictError */
  insert(review: Review): Promise<void>;
  findByFoodOrder(foodOrderId: string): Promise<Review | null>;
  /** 이 중 리뷰가 있는 주문 */
  reviewedOrderIds(foodOrderIds: string[]): Promise<Set<string>>;
  /** 최근 것부터 */
  findByStore(storeId: string, page: PageRequest): Promise<Paged<Review>>;
  /** 가게별 평균 별점(소수 첫째 자리)과 리뷰 수 */
  summaries(
    storeIds: string[],
  ): Promise<Map<string, { average: number; count: number }>>;
}

export interface ConsumerAddressRepository {
  /** 기본 주소 먼저, 그다음 최근 것부터 */
  findByUser(userId: string): Promise<ConsumerAddress[]>;
  findById(id: string): Promise<ConsumerAddress | null>;
  /** 기본 주소로 저장하면 그 손님의 다른 주소는 기본이 아니게 된다 */
  save(address: ConsumerAddress): Promise<void>;
  delete(id: string): Promise<void>;
  deleteAllByUser(userId: string): Promise<void>;
}
