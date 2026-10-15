import {
  Body,
  Controller,
  Get,
  Param,
  ParseEnumPipe,
  ParseUUIDPipe,
  Patch,
  Query,
  StreamableFile,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedUser } from '../../../../common/application/authenticated-user.js';
import { AdminArea } from '../../../admin/domain/admin-role.js';
import { AdminAccess } from '../../../admin/presentation/decorators/admin-access.decorator.js';
import { CurrentUser } from '../../../auth/presentation/decorators/current-user.decorator.js';
import {
  AdminDriverPageResult,
  AdminDriverResult,
} from '../../application/dto/driver.result.js';
import { ListDriversUseCase } from '../../application/use-cases/list-drivers.use-case.js';
import { ReviewDriverUseCase } from '../../application/use-cases/review-driver.use-case.js';
import { DriverDocumentType } from '../../domain/entities/driver-document.entity.js';
import { RejectDriverRequest } from '../dto/driver.request.js';
import { ListDriversRequest } from '../dto/list-drivers.request.js';

/** 기사 심사 컨트롤러. `/admin/drivers` 경로. 기사 심사 권한이 있는 운영자만 부른다. */
@ApiTags('admin')
@ApiBearerAuth()
@AdminAccess(AdminArea.REVIEW)
@Controller('admin/drivers')
export class AdminDriverController {
  constructor(
    private readonly listDriversUseCase: ListDriversUseCase,
    private readonly reviewDriverUseCase: ReviewDriverUseCase,
  ) {}

  /** 기사 신청 목록. 심사 대기는 먼저 신청한 순서, 승인·반려는 최근에 처리한 순서. */
  @Get()
  list(@Query() query: ListDriversRequest): Promise<AdminDriverPageResult> {
    return this.listDriversUseCase.execute(
      { status: query.status, q: query.q },
      query,
    );
  }

  /** 기사 상세. 신청한 사람과 올린 서류의 상태를 함께 준다. */
  @Get(':id')
  detail(@Param('id', ParseUUIDPipe) id: string): Promise<AdminDriverResult> {
    return this.reviewDriverUseCase.detail(id);
  }

  /** 기사가 올린 서류 파일 보기 */
  @Get(':id/documents/:type/file')
  async documentFile(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('type', new ParseEnumPipe(DriverDocumentType))
    type: DriverDocumentType,
  ): Promise<StreamableFile> {
    const file = await this.reviewDriverUseCase.documentFile(id, type);
    return new StreamableFile(file.bytes, { type: file.contentType });
  }

  /** 기사 승인. 기사에게 푸시가 간다. */
  @Patch(':id/approve')
  approve(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<AdminDriverResult> {
    return this.reviewDriverUseCase.approve(id, user.id);
  }

  /** 기사 반려. 사유와 다시 올릴 서류를 적는다. 기사에게 푸시가 간다. */
  @Patch(':id/reject')
  reject(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: RejectDriverRequest,
  ): Promise<AdminDriverResult> {
    return this.reviewDriverUseCase.reject(
      id,
      user.id,
      body.reason,
      body.rejectedDocuments,
    );
  }
}
