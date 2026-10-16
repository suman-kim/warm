import {
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  type RawBodyRequest,
  Req,
} from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { Request } from 'express';
import { Public } from '../../../auth/presentation/decorators/public.decorator.js';
import { CheckoutUseCase } from '../../application/use-cases/checkout.use-case.js';

/** PG 웹훅. `/webhooks/payments` 경로. 서명으로 PG가 보낸 것인지 확인한다. */
@ApiExcludeController()
@Public()
@Controller('webhooks/payments')
export class PaymentWebhookController {
  constructor(private readonly checkout: CheckoutUseCase) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  async receive(
    @Req() request: RawBodyRequest<Request>,
    @Headers() headers: Record<string, string | string[] | undefined>,
  ): Promise<void> {
    await this.checkout.handleWebhook(
      request.rawBody?.toString('utf8') ?? '',
      headers,
    );
  }
}
