import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedUser } from '../../../../common/application/authenticated-user.js';
import { CurrentUser } from '../../../auth/presentation/decorators/current-user.decorator.js';
import { UserResult } from '../../application/dto/user.result.js';
import { GetMyProfileUseCase } from '../../application/use-cases/get-my-profile.use-case.js';
import { UpdateMyProfileUseCase } from '../../application/use-cases/update-my-profile.use-case.js';
import { UpdateProfileRequest } from '../dto/update-profile.request.js';

/** 회원 컨트롤러. `/users` 경로. */
@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UserController {
  constructor(
    private readonly getMyProfileUseCase: GetMyProfileUseCase,
    private readonly updateMyProfileUseCase: UpdateMyProfileUseCase,
  ) {}

  /** 내 정보 */
  @Get('me')
  me(@CurrentUser() user: AuthenticatedUser): Promise<UserResult> {
    return this.getMyProfileUseCase.execute(user.id);
  }

  /** 내 정보 수정. 보낸 항목만 바뀐다. */
  @Patch('me')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: UpdateProfileRequest,
  ): Promise<UserResult> {
    return this.updateMyProfileUseCase.execute(user.id, body);
  }
}
