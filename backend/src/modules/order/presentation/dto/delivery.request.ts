import { Type } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { DoorPayment } from '../../domain/value-objects/store-delivery.js';

/** 손님 주소 (도착지) */
export class DeliveryDestinationRequest {
  /** @example 서울 강남구 역삼로 180 */
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  address: string;

  /** @example 101동 1203호 */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  detailAddress?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  sigungu?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  dong?: string;

  @IsLatitude()
  latitude: number;

  @IsLongitude()
  longitude: number;
}

export class DeliveryCustomerRequest extends DeliveryDestinationRequest {
  /**
   * 손님 연락처 (안심번호여도 된다)
   * @example 050-1234-5678
   */
  @IsString()
  @MaxLength(20)
  phone: string;
}

export class DeliveryQuoteRequest {
  @IsObject()
  @ValidateNested()
  @Type(() => DeliveryDestinationRequest)
  dropoff: DeliveryDestinationRequest;
}

export class RequestDeliveryRequest {
  @IsObject()
  @ValidateNested()
  @Type(() => DeliveryCustomerRequest)
  dropoff: DeliveryCustomerRequest;

  /**
   * 음식값 (원). 만나서 결제면 라이더가 이 금액을 받는다.
   * @example 23000
   */
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  foodAmount: number;

  /** 음식값을 받는 방식 */
  @IsEnum(DoorPayment)
  doorPayment: DoorPayment;

  /**
   * 조리가 끝나 픽업할 수 있을 때까지 남은 분. 0이면 바로.
   * @example 15
   */
  @IsInt()
  @Min(0)
  @Max(180)
  readyInMinutes: number;

  /** @example 문 앞에 두고 벨 눌러 주세요 */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  memo?: string;
}

/** 배송 완료. 만나서 결제하는 가게 배달이면 받은 방식과 금액을 넣는다. */
export class CompleteDeliveryRequest {
  @IsOptional()
  @IsIn([DoorPayment.CASH, DoorPayment.CARD])
  collectedMethod?: DoorPayment.CASH | DoorPayment.CARD;

  /** @example 23000 */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  collectedAmount?: number;
}
