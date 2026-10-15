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
  ChargePolicyResult,
  FareEstimatesResult,
  MessageResult,
  OrderDetailResult,
  OrderListResult,
  OrderResult,
  ReceiptResult,
  RecentDestinationResult,
  ReviewResult,
  toChargePolicyResult,
  TrackingResult,
} from '../../application/dto/order.result.js';
import { CancelOrderUseCase } from '../../application/use-cases/cancel-order.use-case.js';
import { CreateOrderUseCase } from '../../application/use-cases/create-order.use-case.js';
import { EstimateFaresUseCase } from '../../application/use-cases/estimate-fares.use-case.js';
import { GetOrderUseCase } from '../../application/use-cases/get-order.use-case.js';
import { GetTrackingUseCase } from '../../application/use-cases/get-tracking.use-case.js';
import { ListMyOrdersUseCase } from '../../application/use-cases/list-my-orders.use-case.js';
import { ListRecentDestinationsUseCase } from '../../application/use-cases/list-recent-destinations.use-case.js';
import { OrderMessagesUseCase } from '../../application/use-cases/order-messages.use-case.js';
import { RetryPaymentUseCase } from '../../application/use-cases/retry-payment.use-case.js';
import { WriteReviewUseCase } from '../../application/use-cases/write-review.use-case.js';
import { CancelOrderRequest } from '../dto/cancel-order.request.js';
import {
  CreateOrderRequest,
  RetryPaymentRequest,
} from '../dto/create-order.request.js';
import { EstimateFaresRequest } from '../dto/estimate-fares.request.js';
import { ListOrdersRequest } from '../dto/list-orders.request.js';
import {
  ListMessagesRequest,
  RecentDestinationsRequest,
  SendMessageRequest,
  WriteReviewRequest,
} from '../dto/order-extras.request.js';

/** 주문 컨트롤러. `/orders` 경로. 고객이 배송을 요청하고 진행 상황을 본다. */
@ApiTags('orders')
@ApiBearerAuth()
@Controller('orders')
export class OrderController {
  constructor(
    private readonly estimateFaresUseCase: EstimateFaresUseCase,
    private readonly createOrderUseCase: CreateOrderUseCase,
    private readonly listMyOrdersUseCase: ListMyOrdersUseCase,
    private readonly listRecentDestinationsUseCase: ListRecentDestinationsUseCase,
    private readonly getOrderUseCase: GetOrderUseCase,
    private readonly getTrackingUseCase: GetTrackingUseCase,
    private readonly cancelOrderUseCase: CancelOrderUseCase,
    private readonly writeReviewUseCase: WriteReviewUseCase,
    private readonly orderMessagesUseCase: OrderMessagesUseCase,
    private readonly retryPaymentUseCase: RetryPaymentUseCase,
  ) {}

  /** 요금에 붙는 것들의 규칙: 운반 도움·계단·추가 요금 단가, 대기료, 취소 수수료, 노쇼 */
  @Get('charge-policy')
  chargePolicy(): ChargePolicyResult {
    return toChargePolicyResult();
  }

  /** 요금 견적. 거리·예상 시간·경로와 차종별 요금을 한 번에 준다. */
  @Post('estimates')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.CUSTOMER)
  estimates(@Body() body: EstimateFaresRequest): Promise<FareEstimatesResult> {
    return this.estimateFaresUseCase.execute(body);
  }

  /** 배송 요청 */
  @Post()
  @Roles(UserRole.CUSTOMER)
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreateOrderRequest,
  ): Promise<OrderResult> {
    return this.createOrderUseCase.execute(user.id, body);
  }

  /** 내 주문 목록 (최근 요청순) */
  @Get()
  @Roles(UserRole.CUSTOMER)
  listMine(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListOrdersRequest,
  ): Promise<OrderListResult> {
    return this.listMyOrdersUseCase.execute(
      user.id,
      { status: query.status, serviceType: query.serviceType },
      query,
    );
  }

  /** 최근 보낸 곳. 지난 주문의 도착지를 주소별로 한 번씩 준다. */
  @Get('recent-destinations')
  @Roles(UserRole.CUSTOMER)
  recentDestinations(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: RecentDestinationsRequest,
  ): Promise<RecentDestinationResult[]> {
    return this.listRecentDestinationsUseCase.execute(user.id, query.limit);
  }

  /** 주문 상세. 요청한 고객, 배차된 기사, 운영자만 볼 수 있다. */
  @Get(':id')
  get(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<OrderDetailResult> {
    return this.getOrderUseCase.execute(user, id);
  }

  /** 배송 추적. 기사의 현재 위치와 픽업·도착 예정 시각. */
  @Get(':id/tracking')
  tracking(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<TrackingResult> {
    return this.getTrackingUseCase.execute(user, id);
  }

  /** 영수증. 결제한 금액·공급가액·부가세·환불·승인번호. 결제한 적이 없으면 404. */
  @Get(':id/receipt')
  @Roles(UserRole.CUSTOMER)
  receipt(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ReceiptResult> {
    return this.getOrderUseCase.receipt(user, id);
  }

  /** 다른 카드로 다시 요청. 배차 때 결제가 안 된(PAYMENT_FAILED) 주문을 다시 배차 대기로 올린다. */
  @Post(':id/retry-payment')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.CUSTOMER)
  retryPayment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: RetryPaymentRequest,
  ): Promise<OrderResult> {
    return this.retryPaymentUseCase.execute(user.id, id, body.paymentMethodId);
  }

  /**
   * 주문 취소. 기사가 픽업하기 전까지만 할 수 있다.
   * 결제했으면 취소 수수료(기사 출발 전 0원, 출발 뒤 15%)를 빼고 카드로 돌려준다.
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

  /** 기사 평가. 배송이 완료된 주문에 한 번만 남길 수 있다. */
  @Post(':id/review')
  @Roles(UserRole.CUSTOMER)
  review(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: WriteReviewRequest,
  ): Promise<ReviewResult> {
    return this.writeReviewUseCase.execute(user.id, id, body);
  }

  /** 주문 메시지 목록 (보낸 순). 고객과 배차된 기사가 함께 쓴다. */
  @Get(':id/messages')
  @Roles(UserRole.CUSTOMER, UserRole.DRIVER)
  messages(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: ListMessagesRequest,
  ): Promise<MessageResult[]> {
    return this.orderMessagesUseCase.list(user, id, query.after);
  }

  /** 메시지 보내기. 배송이 진행 중일 때만 된다. 받는 쪽에 푸시가 간다. */
  @Post(':id/messages')
  @Roles(UserRole.CUSTOMER, UserRole.DRIVER)
  sendMessage(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: SendMessageRequest,
  ): Promise<MessageResult> {
    return this.orderMessagesUseCase.send(user, id, body.text);
  }
}
