import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserModule } from '../user/user.module.js';
import { LEGAL_CONSENT_RECORDER } from '../../common/application/legal-consent.port.js';
import { LegalConsentsService } from './application/legal-consents.service.js';
import { LegalDocumentsUseCase } from './application/legal-documents.use-case.js';
import { NoticesUseCase } from './application/notices.use-case.js';
import { LEGAL_CONSENT_REPOSITORY } from './domain/legal-consent.js';
import { LEGAL_DOCUMENT_REPOSITORY } from './domain/legal-document.js';
import { NOTICE_REPOSITORY } from './domain/notice.js';
import { LegalConsentOrmEntity } from './infrastructure/entities/legal-consent.orm-entity.js';
import { LegalDocumentOrmEntity } from './infrastructure/entities/legal-document.orm-entity.js';
import { NoticeOrmEntity } from './infrastructure/entities/notice.orm-entity.js';
import {
  LegalConsentTypeormRepository,
  LegalDocumentTypeormRepository,
  NoticeTypeormRepository,
} from './infrastructure/repositories/content.typeorm.repositories.js';
import { AdminContentController } from './presentation/admin-content.controller.js';
import {
  LegalDocumentController,
  NoticeController,
  SupportController,
} from './presentation/content.controller.js';

/** 콘텐츠 모듈. 운영자가 올리는 공지사항과 약관·정책, 고객센터 연락처를 다룬다. */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      NoticeOrmEntity,
      LegalDocumentOrmEntity,
      LegalConsentOrmEntity,
    ]),
    // 운영자 화면에 공지를 올린 사람과 약관을 등록한 사람의 이름을 보여 준다.
    UserModule,
  ],
  controllers: [
    NoticeController,
    LegalDocumentController,
    SupportController,
    AdminContentController,
  ],
  providers: [
    NoticesUseCase,
    LegalDocumentsUseCase,
    { provide: NOTICE_REPOSITORY, useClass: NoticeTypeormRepository },
    {
      provide: LEGAL_DOCUMENT_REPOSITORY,
      useClass: LegalDocumentTypeormRepository,
    },
    {
      provide: LEGAL_CONSENT_REPOSITORY,
      useClass: LegalConsentTypeormRepository,
    },
    { provide: LEGAL_CONSENT_RECORDER, useClass: LegalConsentsService },
  ],
  // 가입(인증 모듈)이 약관 동의를 판 번호와 함께 남긴다.
  exports: [LEGAL_CONSENT_RECORDER],
})
export class ContentModule {}
