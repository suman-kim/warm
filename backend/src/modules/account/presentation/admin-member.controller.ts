import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedUser } from '../../../common/application/authenticated-user.js';
import { AdminArea } from '../../admin/domain/admin-role.js';
import { AdminAccess } from '../../admin/presentation/decorators/admin-access.decorator.js';
import { CurrentUser } from '../../auth/presentation/decorators/current-user.decorator.js';
import {
  MemberDetailResult,
  MemberPageResult,
} from '../application/member.result.js';
import { MembersUseCase } from '../application/members.use-case.js';
import { ListMembersRequest, SuspendMemberRequest } from './member.request.js';

/** 회원 관리 컨트롤러. `/admin/users` 경로. 회원 권한이 있는 운영자만 부른다. */
@ApiTags('admin')
@ApiBearerAuth()
@AdminAccess(AdminArea.MEMBERS)
@Controller('admin/users')
export class AdminMemberController {
  constructor(private readonly membersUseCase: MembersUseCase) {}

  /** 회원 찾기 (고객 또는 기사, 최근에 가입한 회원부터) */
  @Get()
  list(@Query() query: ListMembersRequest): Promise<MemberPageResult> {
    return this.membersUseCase.list(
      {
        role: query.role,
        q: query.q,
        suspended: query.status && query.status === 'SUSPENDED',
      },
      query,
    );
  }

  /** 회원 상세와 정지 이력 */
  @Get(':id')
  detail(@Param('id', ParseUUIDPipe) id: string): Promise<MemberDetailResult> {
    return this.membersUseCase.detail(id);
  }

  /** 정지. 바로 로그아웃되고, 다시 로그인하려 하면 정지 사유가 보인다. */
  @Post(':id/suspensions')
  suspend(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: SuspendMemberRequest,
  ): Promise<MemberDetailResult> {
    return this.membersUseCase.suspend(user.id, id, body);
  }

  /** 정지 해제 */
  @Delete(':id/suspensions/current')
  unsuspend(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<MemberDetailResult> {
    return this.membersUseCase.unsuspend(id);
  }
}
