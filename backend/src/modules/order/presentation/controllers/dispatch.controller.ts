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
import { PageQueryRequest } from '../../../../common/presentation/dto/page-query.request.js';
import { CurrentUser } from '../../../auth/presentation/decorators/current-user.decorator.js';
import { Roles } from '../../../auth/presentation/decorators/roles.decorator.js';
import {
  DriverOrderResult,
  EarningsResult,
  NavigationResult,
  OpenOrderPageResult,
  OpenOrderResult,
  OrderPageResult,
} from '../../application/dto/order.result.js';
import { DriverSettlementsResult } from '../../application/dto/settlement.result.js';
import { AdvanceOrderStageUseCase } from '../../application/use-cases/advance-order-stage.use-case.js';
import { SettlementsUseCase } from '../../application/use-cases/settlements.use-case.js';
import { PickUpRequest } from '../dto/create-order.request.js';
import { toKstPeriod } from '../../application/services/kst-period.js';
import { AcceptOrderUseCase } from '../../application/use-cases/accept-order.use-case.js';
import { CompleteDeliveryUseCase } from '../../application/use-cases/complete-delivery.use-case.js';
import { GetEarningsUseCase } from '../../application/use-cases/get-earnings.use-case.js';
import { GetNavigationUseCase } from '../../application/use-cases/get-navigation.use-case.js';
import { ListMyDeliveriesUseCase } from '../../application/use-cases/list-my-deliveries.use-case.js';
import { ListOpenOrdersUseCase } from '../../application/use-cases/list-open-orders.use-case.js';
import { PickUpOrderUseCase } from '../../application/use-cases/pick-up-order.use-case.js';
import {
  ListDeliveriesRequest,
  PeriodRequest,
} from '../dto/list-orders.request.js';
import { NavigationRequest } from '../dto/order-extras.request.js';

/** 배차 컨트롤러. `/dispatch` 경로. 기사가 주문을 수락하고 배송을 진행한다. */
@ApiTags('dispatch')
@ApiBearerAuth()
@Roles(UserRole.DRIVER)
@Controller('dispatch')
export class DispatchController {
  constructor(
    private readonly listOpenOrdersUseCase: ListOpenOrdersUseCase,
    private readonly listMyDeliveriesUseCase: ListMyDeliveriesUseCase,
    private readonly acceptOrderUseCase: AcceptOrderUseCase,
    private readonly pickUpOrderUseCase: PickUpOrderUseCase,
    private readonly completeDeliveryUseCase: CompleteDeliveryUseCase,
    private readonly getNavigationUseCase: GetNavigationUseCase,
    private readonly getEarningsUseCase: GetEarningsUseCase,
    private readonly advanceOrderStageUseCase: AdvanceOrderStageUseCase,
    private readonly settlementsUseCase: SettlementsUseCase,
  ) {}

  /** 배차 대기 주문 목록. 내 차종으로 요청된 주문만 보인다. */
  @Get('open-orders')
  listOpen(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: PageQueryRequest,
  ): Promise<OpenOrderPageResult> {
    return this.listOpenOrdersUseCase.execute(user.id, query);
  }

  /** 배차 대기 주문 하나. 새 콜 푸시를 받았을 때 그 콜의 내용을 가져온다. 이미 배차됐으면 409. */
  @Get('open-orders/:id')
  getOpen(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<OpenOrderResult> {
    return this.listOpenOrdersUseCase.one(user.id, id);
  }

  /** 내가 배차받은 주문 목록. 기간(from·to)과 상태로 거를 수 있다. */
  @Get('my-orders')
  listMine(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListDeliveriesRequest,
  ): Promise<OrderPageResult> {
    return this.listMyDeliveriesUseCase.execute(
      user.id,
      {
        status: query.status,
        serviceType: query.serviceType,
        period:
          query.from && query.to
            ? toKstPeriod(query.from, query.to)
            : undefined,
      },
      query,
    );
  }

  /** 수입. 기간의 날짜별 수입·완료 건수와 다음 정산 예정액. */
  @Get('earnings')
  earnings(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: PeriodRequest,
  ): Promise<EarningsResult> {
    return this.getEarningsUseCase.execute(user.id, query.from, query.to);
  }

  /** 정산 내역. 이번 주(진행 중), 지급 예정, 지급 완료와 정산 계좌의 본인 확인 상태. */
  @Get('settlements')
  settlements(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<DriverSettlementsResult> {
    return this.settlementsUseCase.forDriver(user.id);
  }

  /**
   * 주문 수락 (배차). 먼저 수락한 기사가 주문을 잡고 고객의 카드로 결제한다 — 늦으면 409 ORDER_NOT_OPEN.
   * 결제가 안 되면 배차되지 않고 409 PAYMENT_DECLINED.
   */
  @Post('orders/:id/accept')
  @HttpCode(HttpStatus.OK)
  accept(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<DriverOrderResult> {
    return this.acceptOrderUseCase.execute(user.id, id);
  }

  /** 픽업지로 출발. 고객에게 알림이 가고, 이때부터 취소 수수료가 붙는다. */
  @Post('orders/:id/depart')
  @HttpCode(HttpStatus.OK)
  depart(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<DriverOrderResult> {
    return this.advanceOrderStageUseCase.depart(user.id, id);
  }

  /** 픽업지 도착. 이때부터 대기 시간이 흐른다 (10분 무료). */
  @Post('orders/:id/arrive')
  @HttpCode(HttpStatus.OK)
  arrive(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<DriverOrderResult> {
    return this.advanceOrderStageUseCase.arrive(user.id, id);
  }

  /** 노쇼 신고. 도착하고 30분이 지나야 된다. 고객이 낸 요금은 돌려주지 않는다. */
  @Post('orders/:id/no-show')
  @HttpCode(HttpStatus.OK)
  reportNoShow(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<DriverOrderResult> {
    return this.advanceOrderStageUseCase.reportNoShow(user.id, id);
  }

  /**
   * 픽업 완료. 실제와 다른 항목이 있으면 추가 요금(과적·큰 짐·계단)을 넣는다.
   * 추가 요금과 대기료는 고객의 카드로 한 번 더 결제된다.
   */
  @Post('orders/:id/pickup')
  @HttpCode(HttpStatus.OK)
  pickUp(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: PickUpRequest,
  ): Promise<DriverOrderResult> {
    return this.pickUpOrderUseCase.execute(user.id, id, {
      overload: body.overload ?? 0,
      bulky: body.bulky ?? 0,
      stairs: body.stairs ?? 0,
    });
  }

  /** 배송 완료 */
  @Post('orders/:id/complete')
  @HttpCode(HttpStatus.OK)
  complete(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<DriverOrderResult> {
    return this.completeDeliveryUseCase.execute(user.id, id);
  }

  /** 길안내. 다음에 갈 곳(픽업지 또는 도착지)까지의 거리·시간·경로. */
  @Get('orders/:id/navigation')
  navigation(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: NavigationRequest,
  ): Promise<NavigationResult> {
    return this.getNavigationUseCase.execute(
      user,
      id,
      query.latitude !== undefined && query.longitude !== undefined
        ? { latitude: query.latitude, longitude: query.longitude }
        : undefined,
    );
  }
}
