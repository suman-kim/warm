import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MarketplacePolicyService } from './application/marketplace-policy.service.js';
import { POLICY_REPOSITORY } from './domain/policy.repository.js';
import {
  PlatformPolicyChangeOrmEntity,
  PlatformPolicyOrmEntity,
} from './infrastructure/entities/platform-policy.orm-entity.js';
import { PolicyTypeormRepository } from './infrastructure/repositories/policy.typeorm.repository.js';
import { AdminPolicyController } from './presentation/admin-policy.controller.js';

/**
 * 정책 모듈. 아직 정하지 않았거나 자주 바뀔 운영 값(주문앱 수수료율, 정산 주기, 손님 가입 방식 등)을
 * DB에 두고 운영자가 바꾼다. 가입·주문앱 모듈이 MarketplacePolicyService로 지금 값을 읽는다.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      PlatformPolicyOrmEntity,
      PlatformPolicyChangeOrmEntity,
    ]),
  ],
  controllers: [AdminPolicyController],
  providers: [
    MarketplacePolicyService,
    { provide: POLICY_REPOSITORY, useClass: PolicyTypeormRepository },
  ],
  exports: [MarketplacePolicyService],
})
export class PlatformPolicyModule {}
