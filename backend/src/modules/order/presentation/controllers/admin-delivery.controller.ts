import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AdminArea } from '../../../admin/domain/admin-role.js';
import { AdminAccess } from '../../../admin/presentation/decorators/admin-access.decorator.js';
import {
  DeliveryMonitorResult,
  DeliveryMonitorSummaryResult,
  RiderCashResult,
} from '../../application/dto/admin-delivery.result.js';
import { AdminDeliveriesUseCase } from '../../application/use-cases/admin-deliveries.use-case.js';
import {
  DeliveryMonitorRequest,
  MarkCashHandedRequest,
  RiderCashRequest,
} from '../dto/admin-delivery.request.js';

/** 배달 관제 컨트롤러. `/admin/deliveries` 경로. 주문 현황 권한이 있는 운영자만 부른다. */
@ApiTags('admin')
@ApiBearerAuth()
@AdminAccess(AdminArea.ORDERS)
@Controller('admin/deliveries')
export class AdminDeliveryController {
  constructor(private readonly deliveries: AdminDeliveriesUseCase) {}

  /** 진행 중인 가게 배달의 단계별 건수와 지연 건수 */
  @Get('summary')
  async summary(): Promise<DeliveryMonitorSummaryResult> {
    return (await this.deliveries.monitor(null)).summary;
  }

  /** 진행 중인 가게 배달. 지연된 것부터, 오래된 것부터. 지연 알림으로 거른다. */
  @Get()
  list(@Query() query: DeliveryMonitorRequest): Promise<DeliveryMonitorResult> {
    return this.deliveries.monitor(query.flag ?? null);
  }
}

/** 라이더 현금 수금 컨트롤러. `/admin/rider-cash` 경로. 정산 권한이 있는 운영자만 부른다. */
@ApiTags('admin')
@ApiBearerAuth()
@AdminAccess(AdminArea.SETTLEMENTS)
@Controller('admin/rider-cash')
export class AdminRiderCashController {
  constructor(private readonly deliveries: AdminDeliveriesUseCase) {}

  /** 그날 라이더가 만나서 현금으로 받은 배달과 가게에 넘겼는지 */
  @Get()
  list(@Query() query: RiderCashRequest): Promise<RiderCashResult> {
    return this.deliveries.cash(query.date, query.handed ?? null);
  }

  /** 가게에 넘김 표시 (되돌릴 수도 있다) */
  @Patch(':id')
  mark(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: MarkCashHandedRequest,
  ): Promise<{ orderId: string; handedAt: Date | null }> {
    return this.deliveries.markHanded(id, body.handed);
  }
}
