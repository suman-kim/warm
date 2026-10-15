import { IsEnum, IsOptional, Matches, ValidateIf } from 'class-validator';
import { ServiceType } from '../../../../common/domain/vehicle-type.js';
import { PageQueryRequest } from '../../../../common/presentation/dto/page-query.request.js';
import { OrderStatus } from '../../domain/order-status.js';

export class ListOrdersRequest extends PageQueryRequest {
  /** 주문 상태 필터. 없으면 전체. */
  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;

  /** 서비스 종류 필터 (퀵·화물). 없으면 전체. */
  @IsOptional()
  @IsEnum(ServiceType)
  serviceType?: ServiceType;
}

export class ListDeliveriesRequest extends ListOrdersRequest {
  /**
   * 기간 시작 (한국 날짜, 그날 포함). to와 함께 보낸다 — 하나만 보내면 400.
   * @example 2026-10-07
   */
  @ValidateIf(
    (o: ListDeliveriesRequest) => o.from !== undefined || o.to !== undefined,
  )
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  from?: string;

  /**
   * 기간 끝 (한국 날짜, 그날 포함)
   * @example 2026-10-13
   */
  @ValidateIf(
    (o: ListDeliveriesRequest) => o.from !== undefined || o.to !== undefined,
  )
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  to?: string;
}

export class PeriodRequest {
  /**
   * 기간 시작 (한국 날짜, 그날 포함)
   * @example 2026-10-07
   */
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  from: string;

  /**
   * 기간 끝 (한국 날짜, 그날 포함)
   * @example 2026-10-13
   */
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  to: string;
}
