import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedUser } from '../../../../common/application/authenticated-user.js';
import { CurrentUser } from '../../../auth/presentation/decorators/current-user.decorator.js';
import {
  AdminAccountResult,
  AdminMeResult,
} from '../../application/dto/admin-account.result.js';
import { AdminAccountsUseCase } from '../../application/use-cases/admin-accounts.use-case.js';
import { AdminArea } from '../../domain/admin-role.js';
import { AdminAccess } from '../decorators/admin-access.decorator.js';
import {
  InviteAdminRequest,
  UpdateAdminRequest,
} from '../dto/admin-account.request.js';

/** 운영자 계정 컨트롤러. `/admin/me`와 `/admin/admins`. */
@ApiTags('admin')
@ApiBearerAuth()
@Controller('admin')
export class AdminAccountController {
  constructor(private readonly adminAccountsUseCase: AdminAccountsUseCase) {}

  /** 로그인한 운영자 자신과 쓸 수 있는 메뉴 */
  @AdminAccess()
  @Get('me')
  me(@CurrentUser() user: AuthenticatedUser): Promise<AdminMeResult> {
    return this.adminAccountsUseCase.me(user.id);
  }

  /** 운영자 목록 */
  @AdminAccess(AdminArea.ADMINS)
  @Get('admins')
  list(): Promise<AdminAccountResult[]> {
    return this.adminAccountsUseCase.list();
  }

  /** 운영자 초대. 초대 메일이 간다. */
  @AdminAccess(AdminArea.ADMINS)
  @Post('admins')
  invite(@Body() body: InviteAdminRequest): Promise<AdminAccountResult> {
    return this.adminAccountsUseCase.invite(body);
  }

  /** 권한 변경, 비활성화·다시 활성화. 자기 계정은 바꿀 수 없다. */
  @AdminAccess(AdminArea.ADMINS)
  @Patch('admins/:id')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateAdminRequest,
  ): Promise<AdminAccountResult> {
    return this.adminAccountsUseCase.update(user.id, id, body);
  }

  /** 초대 메일 다시 보내기 */
  @AdminAccess(AdminArea.ADMINS)
  @Post('admins/:id/invitations')
  @HttpCode(HttpStatus.NO_CONTENT)
  resendInvitation(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.adminAccountsUseCase.resendInvitation(id);
  }
}
