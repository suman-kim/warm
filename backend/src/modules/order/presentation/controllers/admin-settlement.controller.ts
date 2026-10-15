import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedUser } from '../../../../common/application/authenticated-user.js';
import { PageQueryRequest } from '../../../../common/presentation/dto/page-query.request.js';
import { AdminArea } from '../../../admin/domain/admin-role.js';
import { AdminAccess } from '../../../admin/presentation/decorators/admin-access.decorator.js';
import { CurrentUser } from '../../../auth/presentation/decorators/current-user.decorator.js';
import {
  PayoutBatchResult,
  PayoutPageResult,
  SettlementWeekResult,
} from '../../application/dto/settlement.result.js';
import { SettlementsUseCase } from '../../application/use-cases/settlements.use-case.js';
import {
  PaySettlementsRequest,
  SettlementWeekRequest,
} from '../dto/settlement.request.js';

/** 정산 컨트롤러. `/admin/settlements`와 `/admin/payouts`. 정산 권한이 있는 운영자만 부른다. */
@ApiTags('admin')
@ApiBearerAuth()
@AdminAccess(AdminArea.SETTLEMENTS)
@Controller('admin')
export class AdminSettlementController {
  constructor(private readonly settlementsUseCase: SettlementsUseCase) {}

  /** 한 주(월~일)의 기사별 정산. 주를 주지 않으면 가장 최근에 끝난 주. */
  @Get('settlements')
  week(@Query() query: SettlementWeekRequest): Promise<SettlementWeekResult> {
    return this.settlementsUseCase.week(query.weekStart);
  }

  /**
   * 지급 처리. 고른 기사마다 이체하고 결과(완료·진행 중·실패)를 돌려준다.
   * 지금은 운영자가 직접 이체한 것을 기록하는 수동 지급이라 늘 완료다. 완료한 지급은 되돌릴 수 없다.
   */
  @Post('settlements/payouts')
  pay(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: PaySettlementsRequest,
  ): Promise<PayoutBatchResult> {
    return this.settlementsUseCase.pay(user.id, body.weekStart, body.driverIds);
  }

  /** 지급 내역 (최근에 처리한 것부터, 실패 포함) */
  @Get('payouts')
  payouts(@Query() query: PageQueryRequest): Promise<PayoutPageResult> {
    return this.settlementsUseCase.payouts(query);
  }
}
