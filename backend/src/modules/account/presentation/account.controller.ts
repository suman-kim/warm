import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedUser } from '../../../common/application/authenticated-user.js';
import { CurrentUser } from '../../auth/presentation/decorators/current-user.decorator.js';
import { WithdrawRequest } from './withdraw.request.js';
import { WithdrawAccountUseCase } from '../application/withdraw-account.use-case.js';

/** 계정 컨트롤러. 회원 탈퇴. */
@ApiTags('users')
@ApiBearerAuth()
@Controller('users/me')
export class AccountController {
  constructor(
    private readonly withdrawAccountUseCase: WithdrawAccountUseCase,
  ) {}

  /** 회원 탈퇴. 비밀번호를 확인한다. 진행 중인 배송이 있으면 409. */
  @Post('withdraw')
  @HttpCode(HttpStatus.NO_CONTENT)
  withdraw(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: WithdrawRequest,
  ): Promise<void> {
    return this.withdrawAccountUseCase.execute(user.id, body.password);
  }
}
