import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GetMyProfileUseCase } from './application/use-cases/get-my-profile.use-case.js';
import { UpdateMyProfileUseCase } from './application/use-cases/update-my-profile.use-case.js';
import { USER_SUSPENSION_REPOSITORY } from './domain/repositories/user-suspension.repository.js';
import { USER_REPOSITORY } from './domain/repositories/user.repository.js';
import { UserSuspensionOrmEntity } from './infrastructure/entities/user-suspension.orm-entity.js';
import { UserOrmEntity } from './infrastructure/entities/user.orm-entity.js';
import { UserSuspensionTypeormRepository } from './infrastructure/repositories/user-suspension.typeorm.repository.js';
import { UserTypeormRepository } from './infrastructure/repositories/user.typeorm.repository.js';
import { UserController } from './presentation/controllers/user.controller.js';

/** 회원 모듈. */
@Module({
  imports: [TypeOrmModule.forFeature([UserOrmEntity, UserSuspensionOrmEntity])],
  controllers: [UserController],
  providers: [
    GetMyProfileUseCase,
    UpdateMyProfileUseCase,
    { provide: USER_REPOSITORY, useClass: UserTypeormRepository },
    {
      provide: USER_SUSPENSION_REPOSITORY,
      useClass: UserSuspensionTypeormRepository,
    },
  ],
  // 인증·주문 모듈이 회원을 조회하고, 계정 모듈이 정지 기록을 남긴다.
  exports: [USER_REPOSITORY, USER_SUSPENSION_REPOSITORY],
})
export class UserModule {}
