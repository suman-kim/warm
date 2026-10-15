import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import {
  ConsentKind,
  LegalConsentRecorder,
} from '../../../common/application/legal-consent.port.js';
import {
  LEGAL_CONSENT_REPOSITORY,
  type LegalConsentRepository,
} from '../domain/legal-consent.js';
import {
  LEGAL_DOCUMENT_REPOSITORY,
  LegalDocumentType,
  type LegalDocumentRepository,
} from '../domain/legal-document.js';

/** 약관 동의 기록. 동의한 시각에 시행 중인 판 번호를 찾아 함께 남긴다. */
@Injectable()
export class LegalConsentsService implements LegalConsentRecorder {
  constructor(
    @Inject(LEGAL_CONSENT_REPOSITORY)
    private readonly consents: LegalConsentRepository,
    @Inject(LEGAL_DOCUMENT_REPOSITORY)
    private readonly documents: LegalDocumentRepository,
  ) {}

  async record(
    userId: string,
    kinds: ConsentKind[],
    agreedAt: Date,
  ): Promise<void> {
    const consents = await Promise.all(
      kinds.map(async (kind) => {
        const type = LegalDocumentType[kind];
        const current = await this.documents.findCurrent(type, agreedAt);
        return {
          id: randomUUID(),
          userId,
          type,
          version: current?.version ?? null,
          agreedAt,
        };
      }),
    );
    await this.consents.saveAll(consents);
  }
}
