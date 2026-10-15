import { Module } from '@nestjs/common';
import { ACCOUNT_VERIFIER } from './application/ports/account-verifier.port.js';
import { NameMatchAccountVerifier } from './infrastructure/adapters/name-match-account.verifier.js';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FILE_STORAGE } from '../../common/application/file-storage.port.js';
import { LocalFileStorage } from '../../common/infrastructure/storage/local-file.storage.js';
import { UserModule } from '../user/user.module.js';
import { DriverProfile } from './application/services/driver-profile.js';
import { ChangeAvailabilityUseCase } from './application/use-cases/change-availability.use-case.js';
import { DriverDocumentsUseCase } from './application/use-cases/driver-documents.use-case.js';
import { DriverSettingsUseCase } from './application/use-cases/driver-settings.use-case.js';
import { GetMyDriverUseCase } from './application/use-cases/get-my-driver.use-case.js';
import { ListDriversUseCase } from './application/use-cases/list-drivers.use-case.js';
import { RegisterDriverUseCase } from './application/use-cases/register-driver.use-case.js';
import { RequestVehicleChangeUseCase } from './application/use-cases/request-vehicle-change.use-case.js';
import { ReviewDriverUseCase } from './application/use-cases/review-driver.use-case.js';
import {
  DRIVER_DOCUMENT_REPOSITORY,
  DRIVER_LOCATION_REPOSITORY,
  DRIVER_SHIFT_REPOSITORY,
  SETTLEMENT_ACCOUNT_REPOSITORY,
} from './domain/repositories/driver-support.repositories.js';
import { DRIVER_REVIEW_QUERY } from './application/ports/driver-review.query.js';
import { DRIVER_REPOSITORY } from './domain/repositories/driver.repository.js';
import { DriverReviewTypeormQuery } from './infrastructure/queries/driver-review.typeorm.query.js';
import { DriverDocumentOrmEntity } from './infrastructure/entities/driver-document.orm-entity.js';
import { DriverLocationOrmEntity } from './infrastructure/entities/driver-location.orm-entity.js';
import { DriverShiftOrmEntity } from './infrastructure/entities/driver-shift.orm-entity.js';
import { SettlementAccountOrmEntity } from './infrastructure/entities/settlement-account.orm-entity.js';
import { DriverOrmEntity } from './infrastructure/entities/driver.orm-entity.js';
import {
  DriverDocumentTypeormRepository,
  DriverLocationTypeormRepository,
  DriverShiftTypeormRepository,
  SettlementAccountTypeormRepository,
} from './infrastructure/repositories/driver-support.typeorm.repositories.js';
import { DriverTypeormRepository } from './infrastructure/repositories/driver.typeorm.repository.js';
import { AdminDriverController } from './presentation/controllers/admin-driver.controller.js';
import { DriverController } from './presentation/controllers/driver.controller.js';

/** 기사 모듈. 기사 등록·서류·심사와 운행 상태, 위치, 정산 계좌를 다룬다. */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      DriverOrmEntity,
      DriverDocumentOrmEntity,
      DriverShiftOrmEntity,
      DriverLocationOrmEntity,
      SettlementAccountOrmEntity,
    ]),
    // 운영자 심사 화면에 신청한 사람(이름·연락처)을 보여준다.
    UserModule,
  ],
  controllers: [DriverController, AdminDriverController],
  providers: [
    DriverProfile,
    RegisterDriverUseCase,
    GetMyDriverUseCase,
    ChangeAvailabilityUseCase,
    RequestVehicleChangeUseCase,
    DriverDocumentsUseCase,
    DriverSettingsUseCase,
    ReviewDriverUseCase,
    ListDriversUseCase,
    { provide: DRIVER_REPOSITORY, useClass: DriverTypeormRepository },
    { provide: DRIVER_REVIEW_QUERY, useClass: DriverReviewTypeormQuery },
    {
      provide: DRIVER_DOCUMENT_REPOSITORY,
      useClass: DriverDocumentTypeormRepository,
    },
    {
      provide: DRIVER_SHIFT_REPOSITORY,
      useClass: DriverShiftTypeormRepository,
    },
    {
      provide: DRIVER_LOCATION_REPOSITORY,
      useClass: DriverLocationTypeormRepository,
    },
    {
      provide: SETTLEMENT_ACCOUNT_REPOSITORY,
      useClass: SettlementAccountTypeormRepository,
    },
    { provide: FILE_STORAGE, useClass: LocalFileStorage },
    { provide: ACCOUNT_VERIFIER, useClass: NameMatchAccountVerifier },
  ],
  // 주문 모듈이 배차할 때 기사와 그 위치를 조회하고, 탈퇴할 때 서류·운행 상태를 정리한다.
  exports: [
    DRIVER_REPOSITORY,
    DRIVER_LOCATION_REPOSITORY,
    DRIVER_SHIFT_REPOSITORY,
    // 정산 화면에 지급할 계좌를 보여 준다.
    SETTLEMENT_ACCOUNT_REPOSITORY,
  ],
})
export class DriverModule {}
