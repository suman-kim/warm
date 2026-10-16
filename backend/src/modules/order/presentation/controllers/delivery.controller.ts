import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedUser } from '../../../../common/application/authenticated-user.js';
import { UserRole } from '../../../../common/domain/user-role.js';
import { CurrentUser } from '../../../auth/presentation/decorators/current-user.decorator.js';
import { Roles } from '../../../auth/presentation/decorators/roles.decorator.js';
import { OrderResult } from '../../application/dto/order.result.js';
import {
  DeliveryQuote,
  RequestDeliveryUseCase,
} from '../../application/use-cases/request-delivery.use-case.js';
import {
  DeliveryQuoteRequest,
  RequestDeliveryRequest,
} from '../dto/delivery.request.js';

/**
 * 가게 배달 컨트롤러. `/deliveries` 경로. 사장님이 손님에게 보낼 배달을 요청한다.
 * 픽업지는 가게 주소이고, 배달대행료는 충전금에서 빠진다. 진행 상황은 `/orders`로 본다.
 */
@ApiTags('deliveries')
@ApiBearerAuth()
@Roles(UserRole.CUSTOMER)
@Controller('deliveries')
export class DeliveryController {
  constructor(
    private readonly requestDeliveryUseCase: RequestDeliveryUseCase,
  ) {}

  /** 손님 주소까지의 거리와 배달대행료, 지금 충전금 잔액 */
  @Post('quotes')
  @HttpCode(HttpStatus.OK)
  quote(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: DeliveryQuoteRequest,
  ): Promise<DeliveryQuote> {
    return this.requestDeliveryUseCase.quote(user.id, body.dropoff);
  }

  /** 배달 요청. 대행료가 충전금에서 빠지고 근처 라이더들에게 콜이 간다. */
  @Post()
  request(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: RequestDeliveryRequest,
  ): Promise<OrderResult> {
    return this.requestDeliveryUseCase.execute(user.id, body);
  }
}
