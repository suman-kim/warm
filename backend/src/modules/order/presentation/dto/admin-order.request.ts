import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { PageQueryRequest } from '../../../../common/presentation/dto/page-query.request.js';
import { AdminPaymentFilter } from '../../application/ports/admin-order.query.js';
import { OrderStatus } from '../../domain/order-status.js';

export class AdminOrderSummaryRequest {
  /**
   * 한국 날짜
   * @example 2026-10-13
   */
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date: string;
}

export class ListAdminOrdersRequest extends PageQueryRequest {
  /** @example 2026-10-13 */
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date: string;

  /**
   * 주문 상태. 여러 개면 쉼표로 잇는다.
   * @example DEPARTED,ARRIVED,PICKED_UP
   */
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.split(',').filter(Boolean) : value,
  )
  @IsEnum(OrderStatus, { each: true })
  status?: OrderStatus[];

  /** 결제 탭. REFUND는 일부·전액 환불을 함께 본다. */
  @IsOptional()
  @IsEnum(AdminPaymentFilter)
  payment?: AdminPaymentFilter;
}

export class RefundOrderRequest {
  /** 돌려줄 금액(원). 결제한 금액에서 이미 돌려준 금액을 뺀 만큼까지. */
  @IsInt()
  @Min(1)
  amount: number;

  /** @example 배송 지연 */
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  reason: string;
}
