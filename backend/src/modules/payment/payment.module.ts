import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PortOneClient } from '@portone/server-sdk';
import {
  PAYMENT_GATEWAY,
  type PaymentGateway,
} from './application/ports/payment-gateway.port.js';
import { OrderPaymentService } from './application/services/order-payment.service.js';
import { PaymentMethodsUseCase } from './application/use-cases/payment-methods.use-case.js';
import {
  ORDER_CHARGE_REPOSITORY,
  ORDER_REFUND_REPOSITORY,
  PAYMENT_METHOD_REPOSITORY,
} from './domain/repositories/payment.repositories.js';
import { OrderChargeOrmEntity } from './infrastructure/entities/order-charge.orm-entity.js';
import { OrderRefundOrmEntity } from './infrastructure/entities/order-refund.orm-entity.js';
import { PaymentMethodOrmEntity } from './infrastructure/entities/payment-method.orm-entity.js';
import { DevPaymentGateway } from './infrastructure/gateways/dev-payment.gateway.js';
import { PortOnePaymentGateway } from './infrastructure/gateways/portone-payment.gateway.js';
import { OrderChargeTypeormRepository } from './infrastructure/repositories/order-charge.typeorm.repository.js';
import { OrderRefundTypeormRepository } from './infrastructure/repositories/order-refund.typeorm.repository.js';
import { PaymentMethodTypeormRepository } from './infrastructure/repositories/payment-method.typeorm.repository.js';
import { PaymentMethodController } from './presentation/payment-method.controller.js';

/**
 * 결제 모듈. 고객의 카드(빌링키)와 주문의 카드 결제·취소를 다룬다.
 * 포트원 키가 있으면 포트원(PG사 나이스페이먼츠)으로, 없으면 돈이 오가지 않는 개발용 연동으로 돈다.
 * 운영에서는 포트원 키가 없으면 부팅하지 않는다.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      PaymentMethodOrmEntity,
      OrderChargeOrmEntity,
      OrderRefundOrmEntity,
    ]),
  ],
  controllers: [PaymentMethodController],
  providers: [
    PaymentMethodsUseCase,
    OrderPaymentService,
    {
      provide: PAYMENT_METHOD_REPOSITORY,
      useClass: PaymentMethodTypeormRepository,
    },
    {
      provide: ORDER_CHARGE_REPOSITORY,
      useClass: OrderChargeTypeormRepository,
    },
    {
      provide: ORDER_REFUND_REPOSITORY,
      useClass: OrderRefundTypeormRepository,
    },
    {
      provide: PAYMENT_GATEWAY,
      inject: [ConfigService],
      useFactory: (config: ConfigService): PaymentGateway => {
        const storeId = config.get<string>('PORTONE_STORE_ID');
        const channelKey = config.get<string>('PORTONE_CHANNEL_KEY');
        const secret = config.get<string>('PORTONE_API_SECRET');
        if (storeId && channelKey && secret) {
          return new PortOnePaymentGateway(
            PortOneClient({ secret }).payment,
            storeId,
            channelKey,
          );
        }
        if (config.get<string>('NODE_ENV') === 'production') {
          throw new Error(
            '운영에서는 포트원 결제 연동이 필요해요. PORTONE_STORE_ID, PORTONE_CHANNEL_KEY, PORTONE_API_SECRET을 넣어 주세요.',
          );
        }
        return new DevPaymentGateway();
      },
    },
  ],
  // 주문 모듈이 배차·픽업·취소 때 결제와 환불을 부른다.
  exports: [OrderPaymentService],
})
export class PaymentModule {}
