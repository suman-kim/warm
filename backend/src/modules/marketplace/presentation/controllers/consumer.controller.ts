import {
  Body,
  Controller,
  Delete,
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
import { UserRole } from '../../../../common/domain/user-role.js';
import { PageQueryRequest } from '../../../../common/presentation/dto/page-query.request.js';
import { TrackingResult } from '../../../order/application/dto/order.result.js';
import { CurrentUser } from '../../../auth/presentation/decorators/current-user.decorator.js';
import { Roles } from '../../../auth/presentation/decorators/roles.decorator.js';
import {
  ConsumerAddressResult,
  FoodOrderDetailResult,
  FoodOrderSummaryResult,
  Page,
  PlacedFoodOrderResult,
  ReviewResult,
} from '../../application/dto/marketplace.result.js';
import { CheckoutUseCase } from '../../application/use-cases/checkout.use-case.js';
import { ConsumerAddressesUseCase } from '../../application/use-cases/consumer-addresses.use-case.js';
import { ConsumerFoodOrdersUseCase } from '../../application/use-cases/consumer-food-orders.use-case.js';
import {
  ConsumerAddressRequest,
  FoodOrderReasonRequest,
  PlaceFoodOrderRequest,
  ReviewRequest,
} from '../dto/marketplace.request.js';

/** 손님의 배달 주소. `/consumer/addresses` 경로. */
@ApiTags('consumer')
@ApiBearerAuth()
@Roles(UserRole.CONSUMER)
@Controller('consumer/addresses')
export class ConsumerAddressController {
  constructor(private readonly addresses: ConsumerAddressesUseCase) {}

  /** 기본 주소 먼저 */
  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ConsumerAddressResult[]> {
    return this.addresses.list(user.id);
  }

  /** 주소 저장 (최대 10개). 처음 저장한 주소가 기본 주소다. */
  @Post()
  add(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: ConsumerAddressRequest,
  ): Promise<ConsumerAddressResult[]> {
    return this.addresses.add(user.id, body);
  }

  @Put(':id')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: ConsumerAddressRequest,
  ): Promise<ConsumerAddressResult[]> {
    return this.addresses.update(user.id, id, body);
  }

  @Post(':id/default')
  @HttpCode(HttpStatus.OK)
  makeDefault(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ConsumerAddressResult[]> {
    return this.addresses.makeDefault(user.id, id);
  }

  @Delete(':id')
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ConsumerAddressResult[]> {
    return this.addresses.remove(user.id, id);
  }
}

/** 손님의 주문. `/food-orders` 경로. */
@ApiTags('consumer')
@ApiBearerAuth()
@Roles(UserRole.CONSUMER)
@Controller('food-orders')
export class FoodOrderController {
  constructor(
    private readonly checkout: CheckoutUseCase,
    private readonly orders: ConsumerFoodOrdersUseCase,
  ) {}

  /**
   * 주문하기. 금액을 서버가 다시 계산해 PG에 등록하고, 돌려준 checkout으로 결제창을 연다.
   * 결제창이 닫히면 `POST /food-orders/:id/payment/complete`를 부른다.
   */
  @Post()
  place(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: PlaceFoodOrderRequest,
  ): Promise<PlacedFoodOrderResult> {
    return this.checkout.place(user.id, body);
  }

  /** 주문 내역 (결제한 주문만, 최근 것부터) */
  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: PageQueryRequest,
  ): Promise<Page<FoodOrderSummaryResult>> {
    return this.orders.list(user.id, query);
  }

  @Get(':id')
  detail(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<FoodOrderDetailResult> {
    return this.orders.detail(user.id, id);
  }

  /** 결제 확인. PG에 물어 결제됐으면 가게에 주문이 들어간다. */
  @Post(':id/payment/complete')
  @HttpCode(HttpStatus.OK)
  completePayment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<FoodOrderDetailResult> {
    return this.checkout.completePayment(user.id, id);
  }

  /** 라이더 위치와 도착 예정 시각 */
  @Get(':id/tracking')
  track(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<TrackingResult> {
    return this.orders.track(user.id, id);
  }

  /** 취소 (가게가 받기 전까지). 결제했으면 모두 돌려준다. */
  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  cancel(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: FoodOrderReasonRequest,
  ): Promise<FoodOrderDetailResult> {
    return this.orders.cancel(user.id, id, body.reason);
  }

  /** 리뷰 쓰기 (배달이 끝나고 정책의 기간 안, 주문 하나에 한 번) */
  @Post(':id/review')
  review(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: ReviewRequest,
  ): Promise<ReviewResult> {
    return this.orders.review(user.id, id, body);
  }
}
