import {
  Controller,
  Get,
  Param,
  ParseEnumPipe,
  ParseUUIDPipe,
  Query,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedUser } from '../../../common/application/authenticated-user.js';
import { PageQueryRequest } from '../../../common/presentation/dto/page-query.request.js';
import { CurrentUser } from '../../auth/presentation/decorators/current-user.decorator.js';
import { Public } from '../../auth/presentation/decorators/public.decorator.js';
import {
  LegalDocumentResult,
  LegalDocumentSummaryResult,
  NoticePageResult,
  BusinessInfoResult,
  NoticeResult,
  SupportContactResult,
} from '../application/content.result.js';
import { LegalDocumentsUseCase } from '../application/legal-documents.use-case.js';
import { NoticesUseCase } from '../application/notices.use-case.js';
import { LegalDocumentType } from '../domain/legal-document.js';
import { ListLegalDocumentsRequest } from './content.request.js';

/** 공지사항 컨트롤러. `/notices` 경로. 자기 앱에 해당하는 공지만 보인다. */
@ApiTags('content')
@ApiBearerAuth()
@Controller('notices')
export class NoticeController {
  constructor(private readonly noticesUseCase: NoticesUseCase) {}

  /** 공지 목록 (최근 것부터) */
  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: PageQueryRequest,
  ): Promise<NoticePageResult> {
    return this.noticesUseCase.list(user.role, query);
  }

  /** 공지 상세 */
  @Get(':id')
  get(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<NoticeResult> {
    return this.noticesUseCase.get(user.role, id);
  }
}

/** 약관·정책 컨트롤러. `/legal/documents` 경로. 가입 화면에서도 보여야 해서 로그인 없이 부른다. */
@ApiTags('content')
@Public()
@Controller('legal/documents')
export class LegalDocumentController {
  constructor(private readonly legalDocumentsUseCase: LegalDocumentsUseCase) {}

  /** 시행 중인 약관·정책 목록. 앱은 audience에 자기 앱을 적는다. */
  @Get()
  list(
    @Query() query: ListLegalDocumentsRequest,
  ): Promise<LegalDocumentSummaryResult[]> {
    return this.legalDocumentsUseCase.list(query.audience);
  }

  /** 약관·정책 본문 (지금 시행 중인 판) */
  @Get(':type')
  get(
    @Param('type', new ParseEnumPipe(LegalDocumentType))
    type: LegalDocumentType,
  ): Promise<LegalDocumentResult> {
    return this.legalDocumentsUseCase.get(type);
  }
}

/** 고객센터 컨트롤러. `/support` 경로. 로그인하지 못한 사람도 연락할 수 있어야 한다. */
@ApiTags('content')
@Public()
@Controller('support')
export class SupportController {
  constructor(private readonly config: ConfigService) {}

  /** 고객센터 연락처. 서버 환경변수(SUPPORT_*)에 적은 값이다. */
  @Get('contact')
  contact(): SupportContactResult {
    return {
      phone: this.value('SUPPORT_PHONE'),
      email: this.value('SUPPORT_EMAIL'),
      hours: this.value('SUPPORT_HOURS'),
      kakaoChannelUrl: this.value('SUPPORT_KAKAO_CHANNEL_URL'),
    };
  }

  /** 사업자 정보. 서버 환경변수(BUSINESS_*, SUPPORT_*)에 적은 값이다. 적지 않은 칸은 null. */
  @Get('business')
  business(): BusinessInfoResult {
    return {
      name: this.value('BUSINESS_NAME'),
      representative: this.value('BUSINESS_REPRESENTATIVE'),
      registrationNumber: this.value('BUSINESS_REGISTRATION_NUMBER'),
      mailOrderNumber: this.value('BUSINESS_MAIL_ORDER_NUMBER'),
      address: this.value('BUSINESS_ADDRESS'),
      phone: this.value('SUPPORT_PHONE'),
      hours: this.value('SUPPORT_HOURS'),
      email: this.value('SUPPORT_EMAIL'),
    };
  }

  private value(key: string): string | null {
    return this.config.get<string>(key)?.trim() || null;
  }
}
