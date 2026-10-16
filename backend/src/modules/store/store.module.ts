import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserModule } from '../user/user.module.js';
import { AdminStoresUseCase } from './application/admin-stores.use-case.js';
import { StoresUseCase } from './application/stores.use-case.js';
import { TOP_UP_POLICY, TopUpPolicy } from './application/top-up.port.js';
import { STORE_REPOSITORY } from './domain/store.repository.js';
import {
  StoreOrmEntity,
  WalletEntryOrmEntity,
} from './infrastructure/entities/store.orm-entity.js';
import { StoreTypeormRepository } from './infrastructure/repositories/store.typeorm.repository.js';
import {
  AdminStoreController,
  StoreController,
} from './presentation/store.controller.js';

/**
 * 가게 모듈. 배달을 요청하는 음식점(가게)과 그 충전금을 다룬다.
 * 배달대행료는 충전금에서 빠진다 — 주문 모듈이 STORE_REPOSITORY로 차감·환불한다.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([StoreOrmEntity, WalletEntryOrmEntity]),
    // 운영자 화면에 사장님 이름과 이메일을 보여 준다.
    UserModule,
  ],
  controllers: [StoreController, AdminStoreController],
  providers: [
    StoresUseCase,
    AdminStoresUseCase,
    { provide: STORE_REPOSITORY, useClass: StoreTypeormRepository },
    {
      provide: TOP_UP_POLICY,
      inject: [ConfigService],
      // 실제 충전(포트원 가상계좌)을 붙이기 전에는 개발 서버에서만 바로 충전된다.
      useFactory: (config: ConfigService): TopUpPolicy => ({
        instant: config.get<string>('NODE_ENV') !== 'production',
      }),
    },
  ],
  exports: [STORE_REPOSITORY],
})
export class StoreModule {}
