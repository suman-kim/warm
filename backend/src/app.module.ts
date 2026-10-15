import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DomainEventsModule } from './common/infrastructure/events/domain-events.module.js';
import { validateEnv } from './config/env.validation.js';
import { typeOrmModuleOptions } from './config/typeorm.config.js';
import { AccountModule } from './modules/account/account.module.js';
import { AddressModule } from './modules/address/address.module.js';
import { AdminModule } from './modules/admin/admin.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { ContentModule } from './modules/content/content.module.js';
import { DriverModule } from './modules/driver/driver.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { NotificationModule } from './modules/notification/notification.module.js';
import { OrderModule } from './modules/order/order.module.js';
import { PaymentModule } from './modules/payment/payment.module.js';
import { UserModule } from './modules/user/user.module.js';

/** 애플리케이션 루트 모듈. 전역 설정과 DB 연결, 컨텍스트별 모듈을 조립한다. */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // APP_ENV(local|prod, e2e 테스트는 test)에 맞는 .env.<APP_ENV>를 읽고, 없는 값은 .env에서 채운다.
      envFilePath: [`.env.${process.env.APP_ENV ?? 'local'}`, '.env'],
      validate: validateEnv,
    }),
    TypeOrmModule.forRootAsync(typeOrmModuleOptions),
    DomainEventsModule,
    HealthModule,
    UserModule,
    AdminModule,
    AuthModule,
    DriverModule,
    OrderModule,
    PaymentModule,
    NotificationModule,
    AccountModule,
    AddressModule,
    ContentModule,
  ],
})
export class AppModule {}
