import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { PageQueryRequest } from '../../../../common/presentation/dto/page-query.request.js';
import { DriverStatus } from '../../domain/driver-status.js';

export class ListDriversRequest extends PageQueryRequest {
  /** 심사 상태 필터. 없으면 전체. */
  @IsOptional()
  @IsEnum(DriverStatus)
  status?: DriverStatus;

  /** 이름, 이메일, 휴대폰 번호, 차량 번호로 찾는다 */
  @IsOptional()
  @IsString()
  @MaxLength(50)
  q?: string;
}
