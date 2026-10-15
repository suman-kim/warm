import { Type } from 'class-transformer';
import {
  IsDate,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { PageQueryRequest } from '../../../common/presentation/dto/page-query.request.js';
import { LegalDocumentType } from '../domain/legal-document.js';
import { NoticeAudience } from '../domain/notice.js';

export class ListAdminNoticesRequest extends PageQueryRequest {
  /** 게시 중인 공지(LIVE, 기본) 또는 내린 공지(REMOVED) */
  @IsOptional()
  @IsIn(['LIVE', 'REMOVED'])
  state?: 'LIVE' | 'REMOVED';
}

export class ListLegalDocumentsRequest {
  /** 약관을 보는 앱. CUSTOMER면 기사 운송 약관을 뺀다. */
  @IsOptional()
  @IsIn(['CUSTOMER', 'DRIVER'])
  audience?: 'CUSTOMER' | 'DRIVER';
}

export class PublishNoticeRequest {
  /** @example 추석 연휴 배송 안내 */
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  title: string;

  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  body: string;

  /** 공지를 볼 사람 (기본 ALL) */
  @IsOptional()
  @IsEnum(NoticeAudience)
  audience: NoticeAudience = NoticeAudience.ALL;
}

export class PublishLegalDocumentRequest {
  @IsEnum(LegalDocumentType)
  type: LegalDocumentType;

  /**
   * 판 번호. 1부터 올라가는 숫자이고, 같은 종류의 마지막 판보다 커야 한다.
   * @example 2
   */
  @IsString()
  @MinLength(1)
  @MaxLength(6)
  version: string;

  /** @example 서비스 이용약관 */
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  title: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200000)
  body: string;

  /** 시행일. 비우면 바로 시행한다. */
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  effectiveAt?: Date;
}
