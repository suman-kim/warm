import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { PageQueryRequest } from '../../../../common/presentation/dto/page-query.request.js';
import { StoreFoodOrderTab } from '../../application/use-cases/store-food-orders.use-case.js';
import { StorefrontSort } from '../../application/use-cases/browse-storefronts.use-case.js';
import {
  FoodOrderStatus,
  RefundBearer,
} from '../../domain/entities/food-order.entity.js';
import { FoodCategory } from '../../domain/entities/storefront.entity.js';

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const toBoolean = ({ value }: { value: unknown }) =>
  value === 'true' ? true : value === 'false' ? false : value;

// ── 가게 운영 설정 ─────────────────────────────────────────────

export class DeliveryTipRuleRequest {
  /** 이 메뉴 금액 이상이면 (첫 기준은 0) @example 0 */
  @IsInt()
  @Min(0)
  minOrderAmount: number;

  /** 손님이 내는 배달팁 @example 3000 */
  @IsInt()
  @Min(0)
  tip: number;
}

export class DistanceTipRuleRequest {
  /** 이 거리(km)보다 멀면 @example 2 */
  @IsNumber()
  overKm: number;

  /** 더하는 배달팁 @example 1000 */
  @IsInt()
  @Min(0)
  extra: number;
}

export class StorefrontSettingsRequest {
  @IsEnum(FoodCategory)
  category: FoodCategory;

  /** 가게 소개 */
  @IsOptional()
  @IsString()
  @MaxLength(300)
  description: string | null = null;

  /** 원산지 표시 @example 닭고기: 국내산 */
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  originNotice: string | null = null;

  /** 최소 주문 금액 @example 15000 */
  @IsInt()
  @Min(0)
  @Max(100_000)
  minOrderAmount: number;

  /** 배달하는 거리(직선 km, 0.1 단위) @example 3 */
  @IsNumber()
  @Min(0.5)
  @Max(10)
  maxDeliveryKm: number;

  /** 주문금액별 배달팁 (0원 기준부터 오름차순) */
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => DeliveryTipRuleRequest)
  deliveryTipRules: DeliveryTipRuleRequest[];

  /** 거리별 추가 배달팁 (거리 오름차순) */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => DistanceTipRuleRequest)
  distanceTipRules: DistanceTipRuleRequest[] = [];

  /**
   * 요일별 영업시간 [일, 월, …, 토]. 쉬는 요일은 null. close가 open보다 이르면 다음 날 새벽까지.
   * @example [null, {"open":"11:00","close":"22:00"}, {"open":"11:00","close":"22:00"}, {"open":"11:00","close":"22:00"}, {"open":"11:00","close":"22:00"}, {"open":"11:00","close":"02:00"}, {"open":"11:00","close":"02:00"}]
   */
  @IsArray()
  @ArrayMinSize(7)
  @ArrayMaxSize(7)
  businessHours: ({ open: string; close: string } | null)[];

  /** 쉬는 날 (YYYY-MM-DD) */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(60)
  @Matches(DATE, { each: true })
  holidays: string[] = [];
}

export class StorefrontOpenRequest {
  /** 주문 받기 켜기·끄기 */
  @IsBoolean()
  open: boolean;
}

export class StorefrontPauseRequest {
  /** 임시 휴업할 분 (최대 24시간). 비우면 휴업을 끝낸다. @example 60 */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1440)
  minutes: number | null = null;
}

// ── 메뉴 ──────────────────────────────────────────────────────

export class MenuCategoryRequest {
  /** @example 대표 메뉴 */
  @IsString()
  @MinLength(1)
  @MaxLength(30)
  name: string;
}

export class UpdateMenuCategoryRequest extends MenuCategoryRequest {
  /** 보이는 순서 (0부터) */
  @IsInt()
  @Min(0)
  sortOrder: number;
}

export class MenuOptionRequest {
  /** 고칠 때 기존 옵션의 ID. 새 옵션이면 비운다. */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  id?: string;

  /** @example 순살 변경 */
  @IsString()
  @MaxLength(30)
  name: string;

  /** 더해지는 금액 @example 2000 */
  @IsInt()
  @Min(0)
  price: number;

  @IsOptional()
  @IsBoolean()
  soldOut?: boolean;
}

export class MenuOptionGroupRequest {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  id?: string;

  /** @example 부위 선택 */
  @IsString()
  @MaxLength(30)
  name: string;

  /** 최소 선택 (1 이상이면 필수) */
  @IsInt()
  @Min(0)
  minSelect: number;

  @IsInt()
  @Min(1)
  maxSelect: number;

  @IsArray()
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => MenuOptionRequest)
  options: MenuOptionRequest[];
}

export class MenuItemRequest {
  @IsUUID()
  categoryId: string;

  /** @example 후라이드 치킨 */
  @IsString()
  @MaxLength(50)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  description: string | null = null;

  /** @example 18000 */
  @IsInt()
  @Min(0)
  price: number;

  /** 카테고리 안의 순서 (0부터) */
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder: number = 0;

  /** 손님에게 숨기기 */
  @IsOptional()
  @IsBoolean()
  hidden: boolean = false;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => MenuOptionGroupRequest)
  optionGroups: MenuOptionGroupRequest[] = [];
}

export class SoldOutRequest {
  @IsBoolean()
  soldOut: boolean;
}

// ── 손님: 가게 찾기·장바구니·주문 ─────────────────────────────

export class ListStorefrontsRequest extends PageQueryRequest {
  /** 배달 받을 위치 */
  @Type(() => Number)
  @IsLatitude()
  latitude: number;

  @Type(() => Number)
  @IsLongitude()
  longitude: number;

  @IsOptional()
  @IsEnum(FoodCategory)
  category?: FoodCategory;

  /** 가게 이름이나 메뉴 이름 */
  @IsOptional()
  @IsString()
  @MaxLength(50)
  q?: string;

  @IsOptional()
  @IsEnum(StorefrontSort)
  sort: StorefrontSort = StorefrontSort.DISTANCE;

  /** 지금 주문받는 가게만 */
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  openOnly?: boolean;

  /** 최소 주문 금액이 이 이하인 가게만 */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  maxMinOrder?: number;
}

export class StorefrontDetailRequest {
  /** 손님 위치를 주면 배달 가능 여부와 배달팁을 함께 준다 */
  @IsOptional()
  @Type(() => Number)
  @IsLatitude()
  latitude?: number;

  @IsOptional()
  @Type(() => Number)
  @IsLongitude()
  longitude?: number;
}

export class CartOptionRequest {
  @IsString()
  @MaxLength(64)
  groupId: string;

  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  optionIds: string[];
}

export class CartLineRequest {
  @IsUUID()
  menuItemId: string;

  @IsInt()
  @Min(1)
  @Max(50)
  quantity: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => CartOptionRequest)
  options: CartOptionRequest[] = [];
}

export class DropoffRequest {
  /** @example 서울 강남구 테헤란로 152 */
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  address: string;

  /** @example 101동 1203호 */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  detailAddress: string | null = null;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  sigungu: string | null = null;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  dong: string | null = null;

  @IsLatitude()
  latitude: number;

  @IsLongitude()
  longitude: number;
}

export class QuoteRequest {
  @IsArray()
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => CartLineRequest)
  lines: CartLineRequest[];

  @ValidateNested()
  @Type(() => DropoffRequest)
  dropoff: DropoffRequest;
}

export class PlaceFoodOrderRequest extends QuoteRequest {
  @IsUUID()
  storeId: string;

  /** 가게 요청사항 @example 덜 맵게 해 주세요 */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  storeRequest: string | null = null;

  /** 라이더 요청사항 @example 문 앞에 두고 벨 눌러 주세요 */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  riderRequest: string | null = null;

  /** 수저·포크 받기 */
  @IsOptional()
  @IsBoolean()
  disposableCutlery: boolean = false;
}

export class ConsumerAddressRequest extends DropoffRequest {
  /** @example 집 */
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  label: string;

  /** 기본 주소로 */
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class FoodOrderReasonRequest {
  /** 사유 */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  reason: string = '';
}

export class RejectFoodOrderRequest {
  /** 거절 사유 @example 재료 소진 */
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  reason: string;
}

export class AcceptFoodOrderRequest {
  /** 조리 시간(분) — 이 시간에 맞춰 라이더가 온다 @example 20 */
  @IsInt()
  @Min(0)
  @Max(120)
  cookMinutes: number;
}

export class ReviewRequest {
  /** 별점 1~5 */
  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  content: string | null = null;
}

// ── 가게: 주문·정산 ───────────────────────────────────────────

export class StoreFoodOrderListRequest extends PageQueryRequest {
  @IsOptional()
  @IsEnum(StoreFoodOrderTab)
  tab?: StoreFoodOrderTab;

  /** 이날 들어온 주문만 (YYYY-MM-DD) */
  @IsOptional()
  @Matches(DATE)
  date?: string;
}

export class SettlementEntriesRequest extends PageQueryRequest {
  @IsOptional()
  @Matches(DATE)
  from?: string;

  @IsOptional()
  @Matches(DATE)
  to?: string;
}

export class StoreSettlementAccountRequest {
  /** @example 국민은행 */
  @IsString()
  @MaxLength(20)
  bankName: string;

  /** 하이픈은 있어도 된다 @example 123456-01-234567 */
  @IsString()
  @MaxLength(30)
  accountNumber: string;

  /** @example 모보치킨 */
  @IsString()
  @MaxLength(30)
  accountHolder: string;
}

// ── 운영자 ─────────────────────────────────────────────────────

export class AdminFoodOrderListRequest extends PageQueryRequest {
  @IsOptional()
  @IsEnum(FoodOrderStatus)
  status?: FoodOrderStatus;

  @IsOptional()
  @IsUUID()
  storeId?: string;

  @IsOptional()
  @IsUUID()
  consumerUserId?: string;

  /** 가게 접수 지연만 */
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  late?: boolean;

  /** 환불이 실패한 주문만 */
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  refundFailed?: boolean;

  @IsOptional()
  @Matches(DATE)
  from?: string;

  @IsOptional()
  @Matches(DATE)
  to?: string;
}

export class AdminCancelFoodOrderRequest {
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  reason: string;
}

export class AdminRefundRequest {
  /** 돌려줄 금액 @example 5000 */
  @IsInt()
  @Min(1)
  amount: number;

  /** @example 메뉴 누락 */
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  reason: string;

  /** 누가 떠안는지 — STORE면 가게 정산에서 뺀다 */
  @IsEnum(RefundBearer)
  borneBy: RefundBearer;
}

export class StorefrontVisibilityRequest {
  /** 손님 앱에서 내리기(true)·다시 올리기(false) */
  @IsBoolean()
  hidden: boolean;

  /** 내리는 사유 */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  reason: string | null = null;
}

export class SettlementAsOfRequest {
  /** 이 날까지 지급 예정인 정산 (기본 오늘) */
  @IsOptional()
  @Matches(DATE)
  asOf?: string;
}

export class SettlementHoldRequest {
  /** 보류 사유. 비우면 보류를 푼다. */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  reason: string | null = null;
}

export class StorePayoutListRequest extends PageQueryRequest {
  @IsOptional()
  @IsUUID()
  storeId?: string;
}
