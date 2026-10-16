import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { PageQueryRequest } from '../../../common/presentation/dto/page-query.request.js';
import { StoreStatus } from '../domain/store.entity.js';

export class StoreAddressRequest {
  /** @example 서울 강남구 테헤란로 152 */
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  address: string;

  /** @example 1층 */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  detailAddress?: string;

  /** @example 강남구 */
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  sigungu: string;

  /** @example 역삼동 */
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  dong: string;

  @IsLatitude()
  latitude: number;

  @IsLongitude()
  longitude: number;
}

export class StoreRequest {
  /** @example 모보치킨 역삼점 */
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  name: string;

  /**
   * 사업자등록번호 (하이픈은 있어도 된다)
   * @example 220-81-62517
   */
  @IsString()
  @MaxLength(20)
  businessNumber: string;

  /** @example 02-555-1234 */
  @IsString()
  @MaxLength(20)
  phone: string;

  /** 가게 주소 — 배달의 픽업지 */
  @ValidateNested()
  @Type(() => StoreAddressRequest)
  address: StoreAddressRequest;
}

export class TopUpRequest {
  /**
   * 충전할 금액 (원)
   * @example 100000
   */
  @IsInt()
  amount: number;
}

export class RejectStoreRequest {
  /** @example 사업자등록증의 상호와 가게 이름이 달라요. */
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  reason: string;
}

export class AdjustWalletRequest {
  /**
   * 늘릴 금액(+) 또는 줄일 금액(-) (원)
   * @example -3000
   */
  @IsInt()
  amount: number;

  /** @example 배달 사고 보상 */
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  memo: string;
}

export class ListStoresRequest extends PageQueryRequest {
  /** 심사 상태 필터. 없으면 전체. */
  @IsOptional()
  @IsEnum(StoreStatus)
  status?: StoreStatus;

  /** 상호나 사업자등록번호로 찾는다 */
  @IsOptional()
  @IsString()
  @MaxLength(50)
  q?: string;
}
