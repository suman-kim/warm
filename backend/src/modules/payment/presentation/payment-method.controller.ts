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
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedUser } from '../../../common/application/authenticated-user.js';
import { UserRole } from '../../../common/domain/user-role.js';
import { CurrentUser } from '../../auth/presentation/decorators/current-user.decorator.js';
import { Roles } from '../../auth/presentation/decorators/roles.decorator.js';
import {
  CardRegistrationResult,
  PaymentMethodResult,
} from '../application/dto/payment.result.js';
import { PaymentMethodsUseCase } from '../application/use-cases/payment-methods.use-case.js';
import { RegisterPaymentMethodRequest } from './payment-method.request.js';

/** 결제 수단 컨트롤러. `/payment-methods` 경로. 고객이 결제할 카드를 등록하고 관리한다. */
@ApiTags('payments')
@ApiBearerAuth()
@Roles(UserRole.CUSTOMER)
@Controller('payment-methods')
export class PaymentMethodController {
  constructor(private readonly paymentMethodsUseCase: PaymentMethodsUseCase) {}

  /** 등록한 카드 목록 (등록한 순서) */
  @Get()
  list(@CurrentUser() user: AuthenticatedUser): Promise<PaymentMethodResult[]> {
    return this.paymentMethodsUseCase.list(user.id);
  }

  /** 카드 등록 화면을 열 때 필요한 값 (어느 PG사 화면인지, 고객 키) */
  @Get('registration')
  registration(@CurrentUser() user: AuthenticatedUser): CardRegistrationResult {
    return this.paymentMethodsUseCase.registration(user.id);
  }

  /** 카드 등록. PG사 화면에서 받은 인증 키로 빌링키를 발급받는다. */
  @Post()
  register(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: RegisterPaymentMethodRequest,
  ): Promise<PaymentMethodResult> {
    return this.paymentMethodsUseCase.register(
      user.id,
      body.authKey,
      body.makeDefault ?? false,
    );
  }

  /** 기본 카드로 정한다. 배송을 요청할 때 먼저 선택된다. */
  @Post(':id/default')
  @HttpCode(HttpStatus.OK)
  setDefault(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<PaymentMethodResult> {
    return this.paymentMethodsUseCase.setDefault(user.id, id);
  }

  /** 카드 삭제. 이미 결제한 주문은 결제한 카드로 환불된다. */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.paymentMethodsUseCase.remove(user.id, id);
  }
}
