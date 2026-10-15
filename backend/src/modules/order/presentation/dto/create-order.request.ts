import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDate,
  IsEnum,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsNumber,
  IsObject,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { VehicleType } from '../../../../common/domain/vehicle-type.js';
import { LoadingHelp } from '../../domain/services/charge-policy.js';
import { CargoCategory } from '../../domain/value-objects/cargo.js';

/** 층과 엘리베이터. 엘리베이터가 없으면 2층부터 계단 요금이 붙는다. */
export class FloorAccessRequest {
  /** @example 3 */
  @IsInt()
  @Min(1)
  @Max(99)
  floor: number;

  @IsBoolean()
  elevator: boolean;
}

export class WaypointRequest {
  /**
   * 도로명 또는 지번 주소
   * @example 서울 성동구 성수이로 113
   */
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  address: string;

  /**
   * 동·호수 등. 기사가 수락한 뒤에만 보인다.
   * @example 1층 정문
   */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  detailAddress?: string;

  /**
   * 시·군·구. 주소 검색 결과에서 받아 보낸다 — 수락 전 기사에게는 구·동까지만 보인다.
   * @example 성동구
   */
  @IsOptional()
  @IsString()
  @MaxLength(50)
  sigungu?: string;

  /**
   * 읍·면·동
   * @example 성수동2가
   */
  @IsOptional()
  @IsString()
  @MaxLength(50)
  dong?: string;

  /** @example 37.5445 */
  @IsLatitude()
  latitude: number;

  /** @example 127.0557 */
  @IsLongitude()
  longitude: number;

  /**
   * 현장에서 화물을 주고받을 사람
   * @example 김지은
   */
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  contactName: string;

  /** @example 010-1234-5678 */
  @Matches(/^0\d{1,2}-?\d{3,4}-?\d{4}$/, {
    message: 'contactPhone must be a phone number',
  })
  contactPhone: string;
}

export class CargoRequest {
  /** 물품 종류 */
  @IsEnum(CargoCategory)
  category: CargoCategory;

  /**
   * 전체 중량(kg). 차종의 최대 적재 중량을 넘을 수 없다.
   * @example 15
   */
  @IsNumber()
  @IsPositive()
  weightKg: number;

  /** 수량 (기본 1) */
  @IsOptional()
  @IsInt()
  @Min(1)
  quantity?: number;

  /** 종류만으로 부족할 때 덧붙이는 설명 */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  description?: string;
}

export class CreateOrderRequest {
  /** 요청할 차종. 서비스 종류(퀵·화물)는 차종으로 정해진다. */
  @IsEnum(VehicleType)
  vehicleType: VehicleType;

  @IsObject()
  @ValidateNested()
  @Type(() => WaypointRequest)
  pickup: WaypointRequest;

  @IsObject()
  @ValidateNested()
  @Type(() => WaypointRequest)
  dropoff: WaypointRequest;

  @IsObject()
  @ValidateNested()
  @Type(() => CargoRequest)
  cargo: CargoRequest;

  /** 기사에게 전할 요청 사항. 기사가 수락한 뒤에만 보인다. */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  memo?: string;

  /** 예약 픽업 시각 (ISO 8601). 없으면 바로 픽업. */
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  scheduledPickupAt?: Date;

  /** 큰 짐 운반 도움. 없으면 NONE. */
  @IsOptional()
  @IsEnum(LoadingHelp)
  loadingHelp?: LoadingHelp;

  /** 출발지의 층과 엘리베이터. 없으면 1층. */
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => FloorAccessRequest)
  pickupAccess?: FloorAccessRequest;

  /** 도착지의 층과 엘리베이터. 없으면 1층. */
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => FloorAccessRequest)
  dropoffAccess?: FloorAccessRequest;

  /** 결제할 카드 (payment_methods.id). 없으면 기본 카드. 등록한 카드가 없으면 409. */
  @IsOptional()
  @IsUUID()
  paymentMethodId?: string;
}

/** 다른 카드로 다시 요청 */
export class RetryPaymentRequest {
  @IsUUID()
  paymentMethodId: string;
}

/** 기사가 픽업할 때 넣는 추가 요금. 모두 0이면 추가 요금이 없다. */
export class PickUpRequest {
  /** 과적 단계 */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(30)
  overload?: number;

  /** 큰 짐 개수 */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(30)
  bulky?: number;

  /** 엘리베이터 없이 오른 층 */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(30)
  stairs?: number;
}
