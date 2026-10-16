import { Body, Controller, Get, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedUser } from '../../../common/application/authenticated-user.js';
import { AdminArea } from '../../admin/domain/admin-role.js';
import { AdminAccess } from '../../admin/presentation/decorators/admin-access.decorator.js';
import { CurrentUser } from '../../auth/presentation/decorators/current-user.decorator.js';
import {
  MarketplacePolicyResult,
  MarketplacePolicyService,
} from '../application/marketplace-policy.service.js';
import { MarketplacePolicy } from '../domain/marketplace-policy.js';
import { PolicyChange } from '../domain/policy.repository.js';
import { UpdateMarketplacePolicyRequest } from './marketplace-policy.request.js';

/**
 * 주문앱 정책 컨트롤러. `/admin/marketplace-policy`. 돈이 걸린 값이라 정산 권한이 있는 운영자만 바꾼다.
 * 바꾸면 그 뒤의 주문부터 적용된다.
 */
@ApiTags('admin')
@ApiBearerAuth()
@AdminAccess(AdminArea.SETTLEMENTS)
@Controller('admin/marketplace-policy')
export class AdminPolicyController {
  constructor(private readonly policies: MarketplacePolicyService) {}

  /** 지금 정책 */
  @Get()
  get(): Promise<MarketplacePolicyResult> {
    return this.policies.get();
  }

  /** 정책 바꾸기 (준 칸만) */
  @Put()
  update(
    @CurrentUser() admin: AuthenticatedUser,
    @Body() body: UpdateMarketplacePolicyRequest,
  ): Promise<MarketplacePolicyResult> {
    return this.policies.update(admin.id, body);
  }

  /** 바꾼 기록 (최근 50건) */
  @Get('history')
  history(): Promise<PolicyChange<MarketplacePolicy>[]> {
    return this.policies.history();
  }
}
