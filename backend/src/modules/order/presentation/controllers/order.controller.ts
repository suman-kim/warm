import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedUser } from '../../../../common/application/authenticated-user.js';
import { UserRole } from '../../../../common/domain/user-role.js';
import { CurrentUser } from '../../../auth/presentation/decorators/current-user.decorator.js';
import { Roles } from '../../../auth/presentation/decorators/roles.decorator.js';
import {
  OrderDetailResult,
  OrderListResult,
  OrderResult,
  RecentDestinationResult,
  TrackingResult,
} from '../../application/dto/order.result.js';
import { toKstPeriod } from '../../application/services/kst-period.js';
import { CancelOrderUseCase } from '../../application/use-cases/cancel-order.use-case.js';
import { GetOrderUseCase } from '../../application/use-cases/get-order.use-case.js';
import { GetTrackingUseCase } from '../../application/use-cases/get-tracking.use-case.js';
import { ListMyOrdersUseCase } from '../../application/use-cases/list-my-orders.use-case.js';
import { ListRecentDestinationsUseCase } from '../../application/use-cases/list-recent-destinations.use-case.js';
import { CancelOrderRequest } from '../dto/cancel-order.request.js';
import { ListDeliveriesRequest } from '../dto/list-orders.request.js';
import { RecentDestinationsRequest } from '../dto/order-extras.request.js';

/**
 * 배달 조회·취소 컨트롤러. `/orders` 경로. 가게가 요청한 배달의 목록·상세·추적을 보고 취소한다.
 * 배달 요청은 `/deliveries`(DeliveryController)에서 한다.
 */
@ApiTags('orders')
@ApiBearerAuth()
@Controller('orders')
export class OrderController {
  constructor(
    private readonly listMyOrdersUseCase: ListMyOrdersUseCase,
    private readonly listRecentDestinationsUseCase: ListRecentDestinationsUseCase,
    private readonly getOrderUseCase: GetOrderUseCase,
    private readonly getTrackingUseCase: GetTrackingUseCase,
    private readonly cancelOrderUseCase: CancelOrderUseCase,
  ) {}

  /** 내 배달 목록 (최근 요청순). 상태와 요청한 날짜(한국)로 거른다. */
  @Get()
  @Roles(UserRole.CUSTOMER)
  listMine(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListDeliveriesRequest,
  ): Promise<OrderListResult> {
    return this.listMyOrdersUseCase.execute(
      user.id,
      {
        status: query.status,
        period:
          query.from && query.to
            ? toKstPeriod(query.from, query.to)
            : undefined,
      },
      query,
    );
  }

  /** 최근 배달한 주소. 지난 배달의 손님 주소를 주소별로 한 번씩 준다. */
  @Get('recent-destinations')
  @Roles(UserRole.CUSTOMER)
  recentDestinations(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: RecentDestinationsRequest,
  ): Promise<RecentDestinationResult[]> {
    return this.listRecentDestinationsUseCase.execute(user.id, query.limit);
  }

  /** 배달 상세. 요청한 사장님, 배차된 라이더, 운영자만 볼 수 있다. */
  @Get(':id')
  get(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<OrderDetailResult> {
    return this.getOrderUseCase.execute(user, id);
  }

  /** 배달 추적. 라이더의 현재 위치와 픽업·도착 예정 시각. */
  @Get(':id/tracking')
  tracking(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<TrackingResult> {
    return this.getTrackingUseCase.execute(user, id);
  }

  /**
   * 배달 취소. 라이더가 픽업하기 전까지만 할 수 있다.
   * 취소 수수료(라이더 출발·도착 전 0원, 그 뒤 대행료의 15%)를 빼고 충전금으로 돌려준다.
   */
  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.CUSTOMER)
  cancel(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: CancelOrderRequest,
  ): Promise<OrderResult> {
    return this.cancelOrderUseCase.execute(user.id, id, body.reason ?? '');
  }
}
