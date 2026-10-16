import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DriverModule } from '../driver/driver.module.js';
import { StoreModule } from '../store/store.module.js';
import { UserModule } from '../user/user.module.js';
import { ADMIN_DELIVERY_QUERY } from './application/ports/admin-delivery.query.js';
import { DRIVER_DIRECTORY } from './application/ports/driver-directory.port.js';
import { PAYEE_DIRECTORY } from './application/ports/payee-directory.port.js';
import { PAYOUT_GATEWAY } from './application/ports/payout-gateway.port.js';
import {
  ROUTE_PLANNER,
  RoutePlanner,
} from './application/ports/route-planner.port.js';
import { STORE_WALLET } from './application/ports/store-wallet.port.js';
import { DriverOrderTransition } from './application/services/driver-order-transition.js';
import { LinkedDeliveryService } from './application/services/linked-delivery.service.js';
import { OrderAccess } from './application/services/order-access.js';
import { AcceptOrderUseCase } from './application/use-cases/accept-order.use-case.js';
import { AdminDeliveriesUseCase } from './application/use-cases/admin-deliveries.use-case.js';
import { AdvanceOrderStageUseCase } from './application/use-cases/advance-order-stage.use-case.js';
import { CancelOrderUseCase } from './application/use-cases/cancel-order.use-case.js';
import { CompleteDeliveryUseCase } from './application/use-cases/complete-delivery.use-case.js';
import { GetEarningsUseCase } from './application/use-cases/get-earnings.use-case.js';
import { GetOrderUseCase } from './application/use-cases/get-order.use-case.js';
import { GetTrackingUseCase } from './application/use-cases/get-tracking.use-case.js';
import { ListMyDeliveriesUseCase } from './application/use-cases/list-my-deliveries.use-case.js';
import { ListMyOrdersUseCase } from './application/use-cases/list-my-orders.use-case.js';
import { ListOpenOrdersUseCase } from './application/use-cases/list-open-orders.use-case.js';
import { ListRecentDestinationsUseCase } from './application/use-cases/list-recent-destinations.use-case.js';
import { PickUpOrderUseCase } from './application/use-cases/pick-up-order.use-case.js';
import { RequestDeliveryUseCase } from './application/use-cases/request-delivery.use-case.js';
import { SettlementsUseCase } from './application/use-cases/settlements.use-case.js';
import { ORDER_REPOSITORY } from './domain/repositories/order.repository.js';
import { PAYOUT_REPOSITORY } from './domain/repositories/payout.repository.js';
import {
  SETTLEMENT_POLICY,
  SettlementPolicy,
} from './domain/services/settlement-policy.js';
import { DriverDirectoryAdapter } from './infrastructure/adapters/driver-directory.adapter.js';
import { EstimatedRoutePlanner } from './infrastructure/adapters/estimated-route.planner.js';
import { KakaoDirectionsRoutePlanner } from './infrastructure/adapters/kakao-directions.route-planner.js';
import { ManualPayoutGateway } from './infrastructure/adapters/manual-payout.gateway.js';
import { PayeeDirectoryAdapter } from './infrastructure/adapters/payee-directory.adapter.js';
import { StoreWalletAdapter } from './infrastructure/adapters/store-wallet.adapter.js';
import { OrderOrmEntity } from './infrastructure/entities/order.orm-entity.js';
import { PayoutOrmEntity } from './infrastructure/entities/payout.orm-entity.js';
import { OrderEventLogger } from './infrastructure/listeners/order-event.logger.js';
import { AdminDeliveryTypeormQuery } from './infrastructure/queries/admin-delivery.typeorm.query.js';
import { OrderTypeormRepository } from './infrastructure/repositories/order.typeorm.repository.js';
import { PayoutTypeormRepository } from './infrastructure/repositories/payout.typeorm.repository.js';
import {
  AdminDeliveryController,
  AdminRiderCashController,
} from './presentation/controllers/admin-delivery.controller.js';
import { AdminSettlementController } from './presentation/controllers/admin-settlement.controller.js';
import { DeliveryController } from './presentation/controllers/delivery.controller.js';
import { DispatchController } from './presentation/controllers/dispatch.controller.js';
import { OrderController } from './presentation/controllers/order.controller.js';

/**
 * 배달 모듈. 가게의 배달 요청, 라이더의 배차·배달 진행,
 * 그리고 배달에 딸린 추적·수입·정산과 운영자의 배달 관제를 다룬다.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([OrderOrmEntity, PayoutOrmEntity]),
    // DriverDirectoryAdapter가 라이더·회원 저장소를 읽는다.
    DriverModule,
    UserModule,
    // 배달의 픽업지(가게 주소)와 충전금.
    StoreModule,
  ],
  controllers: [
    DeliveryController,
    OrderController,
    DispatchController,
    AdminDeliveryController,
    AdminRiderCashController,
    AdminSettlementController,
  ],
  providers: [
    OrderAccess,
    DriverOrderTransition,
    LinkedDeliveryService,
    RequestDeliveryUseCase,
    GetOrderUseCase,
    GetTrackingUseCase,
    ListMyOrdersUseCase,
    ListRecentDestinationsUseCase,
    CancelOrderUseCase,
    ListOpenOrdersUseCase,
    ListMyDeliveriesUseCase,
    AcceptOrderUseCase,
    AdvanceOrderStageUseCase,
    PickUpOrderUseCase,
    CompleteDeliveryUseCase,
    GetEarningsUseCase,
    AdminDeliveriesUseCase,
    SettlementsUseCase,
    OrderEventLogger,
    { provide: ORDER_REPOSITORY, useClass: OrderTypeormRepository },
    {
      provide: ROUTE_PLANNER,
      inject: [ConfigService],
      // 카카오 REST API 키가 있으면 카카오모빌리티 길찾기로 실제 도로 거리를 쓰고, 안 되면 어림값을 쓴다.
      // 키가 없으면(e2e 테스트 등) 처음부터 어림값이다.
      useFactory: (config: ConfigService): RoutePlanner => {
        const key = config.get<string>('KAKAO_REST_API_KEY');
        const estimated = new EstimatedRoutePlanner();
        return key
          ? new KakaoDirectionsRoutePlanner(key, estimated)
          : estimated;
      },
    },
    { provide: DRIVER_DIRECTORY, useClass: DriverDirectoryAdapter },
    { provide: ADMIN_DELIVERY_QUERY, useClass: AdminDeliveryTypeormQuery },
    { provide: PAYOUT_REPOSITORY, useClass: PayoutTypeormRepository },
    { provide: PAYEE_DIRECTORY, useClass: PayeeDirectoryAdapter },
    // 대행료를 가게 충전금에서 빼고 취소되면 돌려준다.
    { provide: STORE_WALLET, useClass: StoreWalletAdapter },
    // TODO: PG사 지급대행을 붙이면 그 구현으로 바꾼다 (작업 27). 지금은 운영자가 직접 이체한 것을 기록한다.
    { provide: PAYOUT_GATEWAY, useClass: ManualPayoutGateway },
    {
      provide: SETTLEMENT_POLICY,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        new SettlementPolicy(
          config.getOrThrow<number>('COMMISSION_RATE_PERCENT'),
          config.getOrThrow<number>('SETTLEMENT_PAYOUT_WEEKDAY'),
          config.getOrThrow<number>('DRIVER_CANCELLATION_SHARE_PERCENT'),
        ),
    },
  ],
  // 탈퇴할 때 끝나지 않은 배달이 있는지 확인한다. 주문앱이 배달을 요청·취소·추적한다.
  exports: [ORDER_REPOSITORY, LinkedDeliveryService],
})
export class OrderModule {}
