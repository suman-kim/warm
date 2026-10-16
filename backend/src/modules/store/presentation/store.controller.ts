import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedUser } from '../../../common/application/authenticated-user.js';
import { UserRole } from '../../../common/domain/user-role.js';
import { PageQueryRequest } from '../../../common/presentation/dto/page-query.request.js';
import { AdminArea } from '../../admin/domain/admin-role.js';
import { AdminAccess } from '../../admin/presentation/decorators/admin-access.decorator.js';
import { CurrentUser } from '../../auth/presentation/decorators/current-user.decorator.js';
import { Roles } from '../../auth/presentation/decorators/roles.decorator.js';
import { AdminStoresUseCase } from '../application/admin-stores.use-case.js';
import {
  AdminStorePageResult,
  AdminStoreResult,
  StoreResult,
  StoreWalletOverviewResult,
  WalletEntryResult,
  WalletResult,
} from '../application/store.result.js';
import { StoresUseCase } from '../application/stores.use-case.js';
import {
  AdjustWalletRequest,
  ListStoresRequest,
  RejectStoreRequest,
  StoreRequest,
  TopUpRequest,
} from './store.request.js';

/** 가게 컨트롤러. `/stores` 경로. 사장님(고객 앱 계정)이 가게를 등록하고 충전금을 관리한다. */
@ApiTags('stores')
@ApiBearerAuth()
@Roles(UserRole.CUSTOMER)
@Controller('stores')
export class StoreController {
  constructor(private readonly storesUseCase: StoresUseCase) {}

  /** 가게 등록. 운영자가 승인하면 배달을 요청할 수 있다. */
  @Post()
  register(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: StoreRequest,
  ): Promise<StoreResult> {
    return this.storesUseCase.register(user.id, body);
  }

  /** 내 가게 (심사 상태·충전금 잔액 포함) */
  @Get('me')
  mine(@CurrentUser() user: AuthenticatedUser): Promise<StoreResult> {
    return this.storesUseCase.mine(user.id);
  }

  /** 가게 정보 수정. 반려된 가게는 고치면 다시 심사를 받는다. */
  @Put('me')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: StoreRequest,
  ): Promise<StoreResult> {
    return this.storesUseCase.update(user.id, body);
  }

  /** 충전금 잔액과 내역 */
  @Get('me/wallet')
  wallet(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: PageQueryRequest,
  ): Promise<WalletResult> {
    return this.storesUseCase.wallet(user.id, query);
  }

  /** 충전 (지금은 개발 서버에서만 바로 충전된다) */
  @Post('me/wallet/top-ups')
  topUp(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: TopUpRequest,
  ): Promise<WalletEntryResult> {
    return this.storesUseCase.topUp(user.id, body.amount);
  }
}

/** 가게 심사와 충전금 조정 컨트롤러. `/admin/stores` 경로. */
@ApiTags('admin')
@ApiBearerAuth()
@AdminAccess(AdminArea.REVIEW)
@Controller('admin/stores')
export class AdminStoreController {
  constructor(private readonly adminStoresUseCase: AdminStoresUseCase) {}

  /** 가게 목록. 심사 대기는 먼저 신청한 순서. */
  @Get()
  list(@Query() query: ListStoresRequest): Promise<AdminStorePageResult> {
    return this.adminStoresUseCase.list(
      { status: query.status, q: query.q },
      query,
    );
  }

  /** 승인된 가게들의 충전금 현황 (잔액이 적은 가게부터) */
  @AdminAccess(AdminArea.SETTLEMENTS)
  @Get('wallets')
  walletOverview(): Promise<StoreWalletOverviewResult> {
    return this.adminStoresUseCase.walletOverview();
  }

  @Get(':id')
  detail(@Param('id', ParseUUIDPipe) id: string): Promise<AdminStoreResult> {
    return this.adminStoresUseCase.detail(id);
  }

  @Patch(':id/approve')
  approve(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() admin: AuthenticatedUser,
  ): Promise<AdminStoreResult> {
    return this.adminStoresUseCase.approve(id, admin.id);
  }

  @Patch(':id/reject')
  reject(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() admin: AuthenticatedUser,
    @Body() body: RejectStoreRequest,
  ): Promise<AdminStoreResult> {
    return this.adminStoresUseCase.reject(id, body.reason, admin.id);
  }

  /** 충전금 잔액과 내역 */
  @AdminAccess(AdminArea.SETTLEMENTS)
  @Get(':id/wallet')
  wallet(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: PageQueryRequest,
  ): Promise<WalletResult> {
    return this.adminStoresUseCase.wallet(id, query);
  }

  /** 충전금 조정 (+/-). 사유가 내역에 남는다. */
  @AdminAccess(AdminArea.SETTLEMENTS)
  @Post(':id/wallet/adjustments')
  adjust(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() admin: AuthenticatedUser,
    @Body() body: AdjustWalletRequest,
  ): Promise<WalletEntryResult> {
    return this.adminStoresUseCase.adjust(id, body, admin.id);
  }
}
