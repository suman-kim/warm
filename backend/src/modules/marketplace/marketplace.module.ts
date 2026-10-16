import { Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FILE_STORAGE } from '../../common/application/file-storage.port.js';
import { LocalFileStorage } from '../../common/infrastructure/storage/local-file.storage.js';
import { OrderModule } from '../order/order.module.js';
import { PlatformPolicyModule } from '../platform-policy/platform-policy.module.js';
import { StoreModule } from '../store/store.module.js';
import { UserModule } from '../user/user.module.js';
import {
  PAYMENT_GATEWAY,
  PaymentGateway,
} from './application/ports/payment-gateway.port.js';
import { STOREFRONT_QUERY } from './application/ports/storefront.query.js';
import { FoodOrderAccess } from './application/services/food-order-access.js';
import { FoodOrderDeliveries } from './application/services/food-order-deliveries.js';
import { FoodOrderRefunds } from './application/services/food-order-refunds.js';
import { FoodOrderViews } from './application/services/food-order-views.js';
import { OwnedStore } from './application/services/owned-store.js';
import { AdminFoodOrdersUseCase } from './application/use-cases/admin-food-orders.use-case.js';
import { AdminStoreSettlementsUseCase } from './application/use-cases/admin-store-settlements.use-case.js';
import { AdminStorefrontsUseCase } from './application/use-cases/admin-storefronts.use-case.js';
import { BrowseStorefrontsUseCase } from './application/use-cases/browse-storefronts.use-case.js';
import { CheckoutUseCase } from './application/use-cases/checkout.use-case.js';
import { ConsumerAddressesUseCase } from './application/use-cases/consumer-addresses.use-case.js';
import { ConsumerFoodOrdersUseCase } from './application/use-cases/consumer-food-orders.use-case.js';
import { MyMenuUseCase } from './application/use-cases/my-menu.use-case.js';
import { MyStorefrontUseCase } from './application/use-cases/my-storefront.use-case.js';
import { StoreFoodOrdersUseCase } from './application/use-cases/store-food-orders.use-case.js';
import { StoreSettlementsUseCase } from './application/use-cases/store-settlements.use-case.js';
import {
  CONSUMER_ADDRESS_REPOSITORY,
  FOOD_ORDER_REPOSITORY,
  MENU_REPOSITORY,
  REVIEW_REPOSITORY,
  STORE_SETTLEMENT_REPOSITORY,
  STOREFRONT_REPOSITORY,
} from './domain/repositories/marketplace.repositories.js';
import { DevPaymentGateway } from './infrastructure/adapters/dev-payment.gateway.js';
import { DisabledPaymentGateway } from './infrastructure/adapters/disabled-payment.gateway.js';
import { PortOnePaymentGateway } from './infrastructure/adapters/portone-payment.gateway.js';
import { ConsumerAddressOrmEntity } from './infrastructure/entities/consumer-address.orm-entity.js';
import { FoodOrderOrmEntity } from './infrastructure/entities/food-order.orm-entity.js';
import {
  MenuCategoryOrmEntity,
  MenuItemOrmEntity,
} from './infrastructure/entities/menu.orm-entity.js';
import { ReviewOrmEntity } from './infrastructure/entities/review.orm-entity.js';
import {
  StorePayoutOrmEntity,
  StoreSettlementAccountOrmEntity,
  StoreSettlementEntryOrmEntity,
  StoreSettlementHoldOrmEntity,
} from './infrastructure/entities/store-settlement.orm-entity.js';
import { StorefrontOrmEntity } from './infrastructure/entities/storefront.orm-entity.js';
import { FoodOrderDeliveryListener } from './infrastructure/listeners/food-order-delivery.listener.js';
import { StorefrontTypeormQuery } from './infrastructure/queries/storefront.typeorm.query.js';
import { ConsumerAddressTypeormRepository } from './infrastructure/repositories/consumer-address.typeorm.repository.js';
import { FoodOrderTypeormRepository } from './infrastructure/repositories/food-order.typeorm.repository.js';
import { MenuTypeormRepository } from './infrastructure/repositories/menu.typeorm.repository.js';
import { ReviewTypeormRepository } from './infrastructure/repositories/review.typeorm.repository.js';
import { StoreSettlementTypeormRepository } from './infrastructure/repositories/store-settlement.typeorm.repository.js';
import { StorefrontTypeormRepository } from './infrastructure/repositories/storefront.typeorm.repository.js';
import {
  AdminFoodOrderController,
  AdminStoreSettlementController,
  AdminStorefrontController,
} from './presentation/controllers/admin-marketplace.controller.js';
import {
  ConsumerAddressController,
  FoodOrderController,
} from './presentation/controllers/consumer.controller.js';
import { PaymentWebhookController } from './presentation/controllers/payment-webhook.controller.js';
import {
  MyMenuController,
  MyStorefrontController,
  StoreFoodOrderController,
  StoreSettlementController,
} from './presentation/controllers/store-marketplace.controller.js';
import { StorefrontController } from './presentation/controllers/storefront.controller.js';

/**
 * 주문앱(따끈) 모듈. 손님이 가게를 찾아 메뉴를 담고 결제하면 가게가 받고, 받으면 배달 모듈에
 * 배달을 요청한다. 가게의 메뉴·운영 설정, 손님 결제(PG)·환불, 가게 정산, 리뷰를 다룬다.
 * 수수료율·정산 주기 같은 정해지지 않은 값은 정책 모듈에서 읽는다.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      StorefrontOrmEntity,
      MenuCategoryOrmEntity,
      MenuItemOrmEntity,
      FoodOrderOrmEntity,
      StoreSettlementEntryOrmEntity,
      StorePayoutOrmEntity,
      StoreSettlementAccountOrmEntity,
      StoreSettlementHoldOrmEntity,
      ReviewOrmEntity,
      ConsumerAddressOrmEntity,
    ]),
    // 가게(주소·사장님), 손님 이름·연락처, 배달 요청, 수수료율·정산 주기.
    StoreModule,
    UserModule,
    OrderModule,
    PlatformPolicyModule,
  ],
  controllers: [
    StorefrontController,
    ConsumerAddressController,
    FoodOrderController,
    MyStorefrontController,
    MyMenuController,
    StoreFoodOrderController,
    StoreSettlementController,
    AdminFoodOrderController,
    AdminStorefrontController,
    AdminStoreSettlementController,
    PaymentWebhookController,
  ],
  providers: [
    OwnedStore,
    FoodOrderAccess,
    FoodOrderViews,
    FoodOrderRefunds,
    FoodOrderDeliveries,
    MyStorefrontUseCase,
    MyMenuUseCase,
    BrowseStorefrontsUseCase,
    ConsumerAddressesUseCase,
    CheckoutUseCase,
    ConsumerFoodOrdersUseCase,
    StoreFoodOrdersUseCase,
    StoreSettlementsUseCase,
    AdminFoodOrdersUseCase,
    AdminStorefrontsUseCase,
    AdminStoreSettlementsUseCase,
    FoodOrderDeliveryListener,
    { provide: STOREFRONT_REPOSITORY, useClass: StorefrontTypeormRepository },
    { provide: MENU_REPOSITORY, useClass: MenuTypeormRepository },
    { provide: FOOD_ORDER_REPOSITORY, useClass: FoodOrderTypeormRepository },
    {
      provide: STORE_SETTLEMENT_REPOSITORY,
      useClass: StoreSettlementTypeormRepository,
    },
    { provide: REVIEW_REPOSITORY, useClass: ReviewTypeormRepository },
    {
      provide: CONSUMER_ADDRESS_REPOSITORY,
      useClass: ConsumerAddressTypeormRepository,
    },
    { provide: STOREFRONT_QUERY, useClass: StorefrontTypeormQuery },
    { provide: FILE_STORAGE, useClass: LocalFileStorage },
    {
      provide: PAYMENT_GATEWAY,
      inject: [ConfigService],
      // 포트원 키가 있으면 포트원 V2 — PG사(나이스페이먼츠 등)는 채널 키로 정해 코드를 바꾸지 않고 바꾼다.
      // 키가 없으면 개발에서는 결제창 없이 결제되는 개발용, 운영에서는 결제를 받지 않는다.
      useFactory: (config: ConfigService): PaymentGateway => {
        const apiSecret = config.get<string>('PORTONE_API_SECRET') ?? '';
        const storeId = config.get<string>('PORTONE_STORE_ID') ?? '';
        const channelKey = config.get<string>('PORTONE_CHANNEL_KEY') ?? '';
        if (apiSecret && storeId && channelKey) {
          return new PortOnePaymentGateway({
            apiSecret,
            storeId,
            channelKey,
            webhookSecret: config.get<string>('PORTONE_WEBHOOK_SECRET') ?? '',
          });
        }
        if (config.get<string>('NODE_ENV') === 'production') {
          new Logger('MarketplaceModule').warn(
            '포트원 키가 없어 주문앱 결제를 받지 않아요 (PORTONE_API_SECRET·STORE_ID·CHANNEL_KEY).',
          );
          return new DisabledPaymentGateway();
        }
        return new DevPaymentGateway();
      },
    },
  ],
  // 탈퇴할 때 끝나지 않은 주문을 확인하고 저장한 주소를 지운다.
  exports: [FOOD_ORDER_REPOSITORY, CONSUMER_ADDRESS_REPOSITORY],
})
export class MarketplaceModule {}
