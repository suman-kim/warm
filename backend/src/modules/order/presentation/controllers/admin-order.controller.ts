import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedUser } from '../../../../common/application/authenticated-user.js';
import { AdminArea } from '../../../admin/domain/admin-role.js';
import { AdminAccess } from '../../../admin/presentation/decorators/admin-access.decorator.js';
import { CurrentUser } from '../../../auth/presentation/decorators/current-user.decorator.js';
import {
  AdminOrderDetailResult,
  AdminOrderPageResult,
  AdminOrderSummaryResult,
} from '../../application/dto/admin-order.result.js';
import { AdminOrdersUseCase } from '../../application/use-cases/admin-orders.use-case.js';
import {
  AdminOrderSummaryRequest,
  ListAdminOrdersRequest,
  RefundOrderRequest,
} from '../dto/admin-order.request.js';

/** 주문 현황 컨트롤러. `/admin/orders` 경로. 주문 현황 권한이 있는 운영자만 부른다. */
@ApiTags('admin')
@ApiBearerAuth()
@AdminAccess(AdminArea.ORDERS)
@Controller('admin/orders')
export class AdminOrderController {
  constructor(private readonly adminOrdersUseCase: AdminOrdersUseCase) {}

  /** 하루의 상태별·결제별 건수와 결제·환불 금액 */
  @Get('summary')
  summary(
    @Query() query: AdminOrderSummaryRequest,
  ): Promise<AdminOrderSummaryResult> {
    return this.adminOrdersUseCase.summary(query.date);
  }

  /** 하루의 주문 목록 (최근에 요청한 것부터). 상태와 결제 탭으로 거른다. */
  @Get()
  list(@Query() query: ListAdminOrdersRequest): Promise<AdminOrderPageResult> {
    return this.adminOrdersUseCase.list(
      query.date,
      { statuses: query.status, payment: query.payment },
      query,
    );
  }

  /** 주문 상세: 요금 내역, 진행 단계, 고객·기사, 결제·환불 기록 */
  @Get(':id')
  detail(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<AdminOrderDetailResult> {
    return this.adminOrdersUseCase.detail(id);
  }

  /** 환불. 결제한 금액 안에서 일부나 전부를 고객의 카드로 돌려준다. 고객에게 알림이 간다. */
  @Post(':id/refunds')
  refund(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: RefundOrderRequest,
  ): Promise<AdminOrderDetailResult> {
    return this.adminOrdersUseCase.refund(
      user.id,
      id,
      body.amount,
      body.reason,
    );
  }
}
