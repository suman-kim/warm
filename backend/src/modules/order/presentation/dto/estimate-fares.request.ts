import { Type } from 'class-transformer';
import {
  IsEnum,
  IsLatitude,
  IsLongitude,
  IsObject,
  IsOptional,
  ValidateNested,
} from 'class-validator';
import { ServiceType } from '../../../../common/domain/vehicle-type.js';

export class CoordinatesRequest {
  /** @example 37.5445 */
  @IsLatitude()
  latitude: number;

  /** @example 127.0557 */
  @IsLongitude()
  longitude: number;
}

export class EstimateFaresRequest {
  @IsObject()
  @ValidateNested()
  @Type(() => CoordinatesRequest)
  pickup: CoordinatesRequest;

  @IsObject()
  @ValidateNested()
  @Type(() => CoordinatesRequest)
  dropoff: CoordinatesRequest;

  /** 주면 그 서비스의 차종만 견적한다 (퀵 또는 화물). */
  @IsOptional()
  @IsEnum(ServiceType)
  serviceType?: ServiceType;
}
