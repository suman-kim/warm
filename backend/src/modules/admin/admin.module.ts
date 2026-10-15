import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserModule } from '../user/user.module.js';
import { ADMIN_INVITATION_SENDER } from './application/ports/admin-invitation-sender.port.js';
import { AdminAccessService } from './application/services/admin-access.service.js';
import { AdminAccountsUseCase } from './application/use-cases/admin-accounts.use-case.js';
import { ADMIN_ACCOUNT_REPOSITORY } from './domain/repositories/admin-account.repository.js';
import { AdminAccountOrmEntity } from './infrastructure/entities/admin-account.orm-entity.js';
import { AdminAccountTypeormRepository } from './infrastructure/repositories/admin-account.typeorm.repository.js';
import { LoggingAdminInvitationSender } from './infrastructure/services/logging-admin-invitation.sender.js';
import { AdminAccountController } from './presentation/controllers/admin-account.controller.js';

/**
 * 운영자 모듈. 운영자 계정(권한·초대·비활성화)과 운영자 API의 권한 확인을 맡는다.
 * 권한 가드(AdminAccessGuard)는 인증 가드 뒤에 돌아야 해서 AuthModule이 전역으로 등록한다.
 */
@Module({
  imports: [TypeOrmModule.forFeature([AdminAccountOrmEntity]), UserModule],
  controllers: [AdminAccountController],
  providers: [
    AdminAccessService,
    AdminAccountsUseCase,
    {
      provide: ADMIN_ACCOUNT_REPOSITORY,
      useClass: AdminAccountTypeormRepository,
    },
    {
      provide: ADMIN_INVITATION_SENDER,
      useClass: LoggingAdminInvitationSender,
    },
  ],
  // 인증 모듈이 로그인할 때 운영자 상태를 확인하고, 초대 수락을 처리한다.
  exports: [AdminAccessService, ADMIN_ACCOUNT_REPOSITORY],
})
export class AdminModule {}
