import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedUser } from '../../../../common/application/authenticated-user.js';
import { PageQueryRequest } from '../../../../common/presentation/dto/page-query.request.js';
import { AdminArea } from '../../../admin/domain/admin-role.js';
import { AdminAccess } from '../../../admin/presentation/decorators/admin-access.decorator.js';
import { CurrentUser } from '../../../auth/presentation/decorators/current-user.decorator.js';
import {
  AdminStorefrontResult,
  DueStoreSettlementResult,
  FoodOrderDetailResult,
  FoodOrderSummaryResult,
  Page,
  StorePayoutResult,
  StoreSettlementAccountResult,
  StoreSettlementEntryResult,
} from '../../application/dto/marketplace.result.js';
import { AdminFoodOrdersUseCase } from '../../application/use-cases/admin-food-orders.use-case.js';
import { AdminStoreSettlementsUseCase } from '../../application/use-cases/admin-store-settlements.use-case.js';
import { AdminStorefrontsUseCase } from '../../application/use-cases/admin-storefronts.use-case.js';
import {
  AdminCancelFoodOrderRequest,
  AdminFoodOrderListRequest,
  AdminRefundRequest,
  SettlementAsOfRequest,
  SettlementHoldRequest,
  StorefrontVisibilityRequest,
  StorePayoutListRequest,
} from '../dto/marketplace.request.js';

/** 운영자의 주문앱 주문 관제. `/admin/food-orders` 경로. */
@ApiTags('admin')
@ApiBearerAuth()
@AdminAccess(AdminArea.ORDERS)
@Controller('admin/food-orders')
export class AdminFoodOrderController {
  constructor(private readonly orders: AdminFoodOrdersUseCase) {}

  /** 주문 목록. late=true면 가게 접수 지연, refundFailed=true면 환불 실패만. */
  @Get()
  list(@Query() query: AdminFoodOrderListRequest): Promise<
    Page<FoodOrderSummaryResult> & {
      lateCount: number;
      acceptLateMinutes: number;
    }
  > {
    return this.orders.list(
      {
        status: query.status,
        storeId: query.storeId,
        consumerUserId: query.consumerUserId,
        late: query.late,
        refundFailed: query.refundFailed,
        from: query.from,
        to: query.to,
      },
      query,
    );
  }

  @Get(':id')
  detail(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<FoodOrderDetailResult> {
    return this.orders.detail(id);
  }

  /** 취소 (픽업 전). 손님에게 모두 돌려주고 배달도 취소한다. */
  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: AdminCancelFoodOrderRequest,
  ): Promise<FoodOrderDetailResult> {
    return this.orders.cancel(id, body.reason);
  }

  /** 배달이 끝난 주문의 부분 환불. borneBy=STORE면 가게 정산에서 뺀다. */
  @Post(':id/refunds')
  @HttpCode(HttpStatus.OK)
  refund(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: AdminRefundRequest,
  ): Promise<FoodOrderDetailResult> {
    return this.orders.refund(user.id, id, body);
  }

  /** 실패한 환불을 PG에 다시 요청 */
  @Post(':id/refunds/retry')
  @HttpCode(HttpStatus.OK)
  retryRefunds(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<FoodOrderDetailResult> {
    return this.orders.retryRefunds(id);
  }
}

/** 운영자의 입점 검수 (주문앱 가게 설정·메뉴·사진). `/admin/storefronts` 경로. */
@ApiTags('admin')
@ApiBearerAuth()
@AdminAccess(AdminArea.REVIEW)
@Controller('admin/storefronts')
export class AdminStorefrontController {
  constructor(private readonly storefronts: AdminStorefrontsUseCase) {}

  @Get(':storeId')
  get(
    @Param('storeId', ParseUUIDPipe) storeId: string,
  ): Promise<AdminStorefrontResult> {
    return this.storefronts.get(storeId);
  }

  /** 손님 앱에서 내리기(사유 필수)·다시 올리기 */
  @Put(':storeId/visibility')
  setVisibility(
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Body() body: StorefrontVisibilityRequest,
  ): Promise<AdminStorefrontResult> {
    return this.storefronts.setHidden(
      storeId,
      body.hidden,
      body.reason ?? null,
    );
  }
}

/** 운영자의 가게 정산. `/admin/store-settlements`, `/admin/store-payouts` 경로. */
@ApiTags('admin')
@ApiBearerAuth()
@AdminAccess(AdminArea.SETTLEMENTS)
@Controller('admin')
export class AdminStoreSettlementController {
  constructor(private readonly settlements: AdminStoreSettlementsUseCase) {}

  /** asOf(기본 오늘)까지 지급 예정인데 아직 보내지 않은 정산 (가게별) */
  @Get('store-settlements')
  due(
    @Query() query: SettlementAsOfRequest,
  ): Promise<{ asOf: string; items: DueStoreSettlementResult[] }> {
    return this.settlements.due(query.asOf);
  }

  /** 가게 하나의 정산을 보냈다고 기록 (계좌 확인됨, 보류 아님) */
  @Post('store-settlements/:storeId/pay')
  pay(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Body() body: SettlementAsOfRequest,
  ): Promise<StorePayoutResult> {
    return this.settlements.pay(user.id, storeId, body.asOf);
  }

  /** 가게의 정산 내역 */
  @Get('store-settlements/:storeId/entries')
  entries(
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Query() query: PageQueryRequest,
  ): Promise<Page<StoreSettlementEntryResult>> {
    return this.settlements.entries(storeId, query);
  }

  /** 가게의 정산 계좌 (전체 번호 포함). 없으면 null. */
  @Get('store-settlements/:storeId/account')
  account(
    @Param('storeId', ParseUUIDPipe) storeId: string,
  ): Promise<
    (StoreSettlementAccountResult & { accountNumber: string }) | null
  > {
    return this.settlements.account(storeId);
  }

  /** 계좌를 확인했다 (통장 사본 등) */
  @Post('store-settlements/:storeId/account/verify')
  @HttpCode(HttpStatus.OK)
  verifyAccount(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId', ParseUUIDPipe) storeId: string,
  ): Promise<StoreSettlementAccountResult> {
    return this.settlements.verifyAccount(user.id, storeId);
  }

  /** 지급 보류 (reason을 비우면 보류를 푼다) */
  @Put('store-settlements/:storeId/hold')
  @HttpCode(HttpStatus.NO_CONTENT)
  hold(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Body() body: SettlementHoldRequest,
  ): Promise<void> {
    return this.settlements.hold(
      user.id,
      storeId,
      body.reason?.trim() ? body.reason : null,
    );
  }

  /** 지급 내역 */
  @Get('store-payouts')
  payouts(
    @Query() query: StorePayoutListRequest,
  ): Promise<Page<StorePayoutResult>> {
    return this.settlements.payouts({ storeId: query.storeId }, query);
  }
}
