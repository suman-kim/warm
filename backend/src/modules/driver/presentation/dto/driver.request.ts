import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEnum,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { VehicleType } from '../../../../common/domain/vehicle-type.js';
import { DriverDocumentType } from '../../domain/entities/driver-document.entity.js';

export class VehicleRequest {
  /** 등록한 차종과 같은 콜만 받는다. */
  @IsEnum(VehicleType)
  vehicleType: VehicleType;

  /**
   * 차량 번호
   * @example 서울 81바 2047
   */
  @IsString()
  @MinLength(4)
  @MaxLength(20)
  vehicleNumber: string;
}

export class ChangeAvailabilityRequest {
  /** true면 운행 시작(온라인), false면 종료(오프라인) */
  @IsBoolean()
  available: boolean;
}

export class ReportLocationRequest {
  /** @example 37.5445 */
  @IsLatitude()
  latitude: number;

  /** @example 127.0557 */
  @IsLongitude()
  longitude: number;
}

export class SettlementAccountRequest {
  /** @example 국민 */
  @IsString()
  @MinLength(1)
  @MaxLength(30)
  bankName: string;

  /**
   * 하이픈이 있어도 된다.
   * @example 123456-78-901024
   */
  @Matches(/^[\d\s-]{8,24}$/, {
    message: 'accountNumber must be an account number',
  })
  accountNumber: string;

  /** 예금주 */
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  accountHolder: string;
}

export class RejectDriverRequest {
  /** 반려 사유. 기사에게 그대로 보인다. */
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  reason: string;

  /** 다시 올려야 하는 서류. 적지 않은 서류는 확인된 것으로 표시된다. */
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsEnum(DriverDocumentType, { each: true })
  rejectedDocuments?: DriverDocumentType[];
}
