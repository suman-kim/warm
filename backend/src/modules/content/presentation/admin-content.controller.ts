import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
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
  AdminLegalDocumentResult,
  AdminNoticePageResult,
  AdminNoticeResult,
} from '../application/content.result.js';
import { LegalDocumentsUseCase } from '../application/legal-documents.use-case.js';
import { NoticesUseCase } from '../application/notices.use-case.js';
import {
  ListAdminNoticesRequest,
  PublishLegalDocumentRequest,
  PublishNoticeRequest,
} from './content.request.js';

/** 공지·약관 관리 컨트롤러. `/admin` 경로. 해당 메뉴의 권한이 있는 운영자만 부른다. */
@ApiTags('admin')
@ApiBearerAuth()
@Controller('admin')
export class AdminContentController {
  constructor(
    private readonly noticesUseCase: NoticesUseCase,
    private readonly legalDocumentsUseCase: LegalDocumentsUseCase,
  ) {}

  /** 공지 목록 — 게시 중인 공지(기본) 또는 내린 공지 */
  @AdminAccess(AdminArea.NOTICES)
  @Get('notices')
  notices(
    @Query() query: ListAdminNoticesRequest,
  ): Promise<AdminNoticePageResult> {
    return this.noticesUseCase.listForAdmin(query.state !== 'REMOVED', query);
  }

  /** 공지 올리기. 대상 앱에 바로 보인다. */
  @AdminAccess(AdminArea.NOTICES)
  @Post('notices')
  publishNotice(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: PublishNoticeRequest,
  ): Promise<AdminNoticeResult> {
    return this.noticesUseCase.publish({ ...body, authorId: user.id });
  }

  /** 공지 내리기. 앱에서 바로 사라지고 기록으로 남는다. */
  @AdminAccess(AdminArea.NOTICES)
  @Delete('notices/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeNotice(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.noticesUseCase.remove(id);
  }

  /** 약관·정책의 모든 판 (시행 중·시행 예정·이전 판) */
  @AdminAccess(AdminArea.TERMS)
  @Get('legal-documents')
  legalDocuments(): Promise<AdminLegalDocumentResult[]> {
    return this.legalDocumentsUseCase.listForAdmin();
  }

  /** 약관·정책의 새 판 올리기. 지난 판은 지우지 않는다. */
  @AdminAccess(AdminArea.TERMS)
  @Post('legal-documents')
  publishLegalDocument(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: PublishLegalDocumentRequest,
  ): Promise<AdminLegalDocumentResult> {
    return this.legalDocumentsUseCase.publish({ ...body, createdBy: user.id });
  }
}
