import { Module } from '@nestjs/common';
import { AddressModule } from '../address/address.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { DriverModule } from '../driver/driver.module.js';
import { NotificationModule } from '../notification/notification.module.js';
import { OrderModule } from '../order/order.module.js';
import { UserModule } from '../user/user.module.js';
import { MEMBER_QUERY } from './application/member.query.js';
import { MembersUseCase } from './application/members.use-case.js';
import { WithdrawAccountUseCase } from './application/withdraw-account.use-case.js';
import { MemberTypeormQuery } from './infrastructure/member.typeorm.query.js';
import { AccountController } from './presentation/account.controller.js';
import { AdminMemberController } from './presentation/admin-member.controller.js';

/**
 * 계정 모듈. 여러 컨텍스트에 걸친 계정 작업(회원 탈퇴, 운영자의 회원 조회·정지)을 맡는다.
 * 다른 모듈들을 가져다 쓰기만 하고, 다른 모듈은 이 모듈을 모른다.
 */
@Module({
  imports: [
    UserModule,
    AuthModule,
    OrderModule,
    DriverModule,
    NotificationModule,
    AddressModule,
  ],
  controllers: [AccountController, AdminMemberController],
  providers: [
    WithdrawAccountUseCase,
    MembersUseCase,
    { provide: MEMBER_QUERY, useClass: MemberTypeormQuery },
  ],
})
export class AccountModule {}
