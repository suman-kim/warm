import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DriverModule } from '../driver/driver.module.js';
import { PaymentModule } from '../payment/payment.module.js';
import { UserModule } from '../user/user.module.js';
import { DRIVER_DIRECTORY } from './application/ports/driver-directory.port.js';
import { ADMIN_ORDER_QUERY } from './application/ports/admin-order.query.js';
import { ORDER_PAYMENTS } from './application/ports/order-payments.port.js';
import { PAYEE_DIRECTORY } from './application/ports/payee-directory.port.js';
import { PAYOUT_GATEWAY } from './application/ports/payout-gateway.port.js';
import { AdvanceOrderStageUseCase } from './application/use-cases/advance-order-stage.use-case.js';
import { RetryPaymentUseCase } from './application/use-cases/retry-payment.use-case.js';
import { ManualPayoutGateway } from './infrastructure/adapters/manual-payout.gateway.js';
import { OrderPaymentsAdapter } from './infrastructure/adapters/order-payments.adapter.js';
import {
  ROUTE_PLANNER,
  RoutePlanner,
} from './application/ports/route-planner.port.js';
import { AdminOrdersUseCase } from './application/use-cases/admin-orders.use-case.js';
import { SettlementsUseCase } from './application/use-cases/settlements.use-case.js';
import { PAYOUT_REPOSITORY } from './domain/repositories/payout.repository.js';
import {
  SETTLEMENT_POLICY,
  SettlementPolicy,
} from './domain/services/settlement-policy.js';
import { PayeeDirectoryAdapter } from './infrastructure/adapters/payee-directory.adapter.js';
import { PayoutOrmEntity } from './infrastructure/entities/payout.orm-entity.js';
import { AdminOrderTypeormQuery } from './infrastructure/queries/admin-order.typeorm.query.js';
import { PayoutTypeormRepository } from './infrastructure/repositories/payout.typeorm.repository.js';
import { AdminOrderController } from './presentation/controllers/admin-order.controller.js';
import { AdminSettlementController } from './presentation/controllers/admin-settlement.controller.js';
import { DriverOrderTransition } from './application/services/driver-order-transition.js';
import { OrderAccess } from './application/services/order-access.js';
import { AcceptOrderUseCase } from './application/use-cases/accept-order.use-case.js';
import { CancelOrderUseCase } from './application/use-cases/cancel-order.use-case.js';
import { CompleteDeliveryUseCase } from './application/use-cases/complete-delivery.use-case.js';
import { CreateOrderUseCase } from './application/use-cases/create-order.use-case.js';
import { EstimateFaresUseCase } from './application/use-cases/estimate-fares.use-case.js';
import { GetEarningsUseCase } from './application/use-cases/get-earnings.use-case.js';
import { GetNavigationUseCase } from './application/use-cases/get-navigation.use-case.js';
import { GetOrderUseCase } from './application/use-cases/get-order.use-case.js';
import { GetTrackingUseCase } from './application/use-cases/get-tracking.use-case.js';
import { ListMyDeliveriesUseCase } from './application/use-cases/list-my-deliveries.use-case.js';
import { ListMyOrdersUseCase } from './application/use-cases/list-my-orders.use-case.js';
import { ListOpenOrdersUseCase } from './application/use-cases/list-open-orders.use-case.js';
import { ListRecentDestinationsUseCase } from './application/use-cases/list-recent-destinations.use-case.js';
import { OrderMessagesUseCase } from './application/use-cases/order-messages.use-case.js';
import { PickUpOrderUseCase } from './application/use-cases/pick-up-order.use-case.js';
import { WriteReviewUseCase } from './application/use-cases/write-review.use-case.js';
import { ORDER_MESSAGE_REPOSITORY } from './domain/repositories/order-message.repository.js';
import { ORDER_REPOSITORY } from './domain/repositories/order.repository.js';
import { REVIEW_REPOSITORY } from './domain/repositories/review.repository.js';
import { DriverDirectoryAdapter } from './infrastructure/adapters/driver-directory.adapter.js';
import { EstimatedRoutePlanner } from './infrastructure/adapters/estimated-route.planner.js';
import { KakaoDirectionsRoutePlanner } from './infrastructure/adapters/kakao-directions.route-planner.js';
import { OrderMessageOrmEntity } from './infrastructure/entities/order-message.orm-entity.js';
import { OrderOrmEntity } from './infrastructure/entities/order.orm-entity.js';
import { ReviewOrmEntity } from './infrastructure/entities/review.orm-entity.js';
import { OrderEventLogger } from './infrastructure/listeners/order-event.logger.js';
import { OrderMessageTypeormRepository } from './infrastructure/repositories/order-message.typeorm.repository.js';
import { OrderTypeormRepository } from './infrastructure/repositories/order.typeorm.repository.js';
import { ReviewTypeormRepository } from './infrastructure/repositories/review.typeorm.repository.js';
import { DispatchController } from './presentation/controllers/dispatch.controller.js';
import { OrderController } from './presentation/controllers/order.controller.js';
import { VehicleTypeController } from './presentation/controllers/vehicle-type.controller.js';

/**
 * 주문 모듈. 고객의 배송 요청과 기사의 배차·배송 진행,
 * 그리고 주문에 딸린 추적·메시지·평가·수입을 다룬다.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      OrderOrmEntity,
      ReviewOrmEntity,
      OrderMessageOrmEntity,
      PayoutOrmEntity,
    ]),
    // DriverDirectoryAdapter가 기사·회원 저장소를 읽는다.
    DriverModule,
    UserModule,
    // 배차·픽업 때 결제하고 취소·운영자 환불 때 돌려준다.
    PaymentModule,
  ],
  controllers: [
    OrderController,
    DispatchController,
    VehicleTypeController,
    AdminOrderController,
    AdminSettlementController,
  ],
  providers: [
    OrderAccess,
    DriverOrderTransition,
    EstimateFaresUseCase,
    CreateOrderUseCase,
    GetOrderUseCase,
    GetTrackingUseCase,
    ListMyOrdersUseCase,
    ListRecentDestinationsUseCase,
    CancelOrderUseCase,
    WriteReviewUseCase,
    OrderMessagesUseCase,
    ListOpenOrdersUseCase,
    ListMyDeliveriesUseCase,
    AcceptOrderUseCase,
    AdvanceOrderStageUseCase,
    PickUpOrderUseCase,
    RetryPaymentUseCase,
    CompleteDeliveryUseCase,
    GetNavigationUseCase,
    GetEarningsUseCase,
    AdminOrdersUseCase,
    SettlementsUseCase,
    OrderEventLogger,
    { provide: ORDER_REPOSITORY, useClass: OrderTypeormRepository },
    { provide: REVIEW_REPOSITORY, useClass: ReviewTypeormRepository },
    {
      provide: ORDER_MESSAGE_REPOSITORY,
      useClass: OrderMessageTypeormRepository,
    },
    {
      provide: ROUTE_PLANNER,
      inject: [ConfigService],
      // 카카오 REST API 키가 있으면 카카오모빌리티 길찾기로 실제 도로 경로를 쓰고, 안 되면 어림값을 쓴다.
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
    { provide: ADMIN_ORDER_QUERY, useClass: AdminOrderTypeormQuery },
    { provide: PAYOUT_REPOSITORY, useClass: PayoutTypeormRepository },
    { provide: PAYEE_DIRECTORY, useClass: PayeeDirectoryAdapter },
    { provide: ORDER_PAYMENTS, useClass: OrderPaymentsAdapter },
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
  // 탈퇴할 때 끝나지 않은 주문이 있는지 확인한다.
  exports: [ORDER_REPOSITORY],
})
export class OrderModule {}
