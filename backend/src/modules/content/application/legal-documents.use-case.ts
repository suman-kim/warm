import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { NotFoundError } from '../../../common/domain/domain-error.js';
import {
  USER_REPOSITORY,
  type UserRepository,
} from '../../user/domain/repositories/user.repository.js';
import {
  LEGAL_DOCUMENT_REPOSITORY,
  LegalDocument,
  type LegalDocumentRepository,
  LegalDocumentType,
} from '../domain/legal-document.js';
import {
  AdminLegalDocumentResult,
  LegalDocumentResult,
  LegalDocumentSummaryResult,
  toLegalDocumentResult,
  toLegalDocumentSummary,
} from './content.result.js';

/** 약관을 보는 앱. 기사 운송 약관은 기사 앱에만 보인다. */
export type LegalAudience = 'CUSTOMER' | 'DRIVER';

/** 약관·정책 유스케이스. 종류마다 지금 시행 중인 판을 보여 준다. */
@Injectable()
export class LegalDocumentsUseCase {
  constructor(
    @Inject(LEGAL_DOCUMENT_REPOSITORY)
    private readonly repository: LegalDocumentRepository,
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepository,
  ) {}

  /** 시행 중인 문서 목록. 아직 올리지 않은 종류는 빠진다. */
  async list(audience?: LegalAudience): Promise<LegalDocumentSummaryResult[]> {
    const now = new Date();
    const types = Object.values(LegalDocumentType).filter(
      (type) => type !== LegalDocumentType.DRIVER || audience !== 'CUSTOMER',
    );
    const documents = await Promise.all(
      types.map((type) => this.repository.findCurrent(type, now)),
    );
    return documents
      .filter((document) => document !== null)
      .map(toLegalDocumentSummary);
  }

  async get(type: LegalDocumentType): Promise<LegalDocumentResult> {
    const document = await this.repository.findCurrent(type, new Date());
    if (!document) {
      throw new NotFoundError(
        'LEGAL_DOCUMENT_NOT_FOUND',
        '문서를 찾을 수 없어요.',
      );
    }
    return toLegalDocumentResult(document);
  }

  /** 운영자용 목록. 모든 종류의 모든 판을 상태(시행 중·시행 예정·이전 판)와 함께 준다. */
  async listForAdmin(): Promise<AdminLegalDocumentResult[]> {
    const now = new Date();
    const documents = await this.repository.findAll();
    const registrants = await this.userRepository.findByIds([
      ...new Set(documents.flatMap((document) => document.createdBy ?? [])),
    ]);
    const nameById = new Map(registrants.map((user) => [user.id, user.name]));
    return documents
      .sort(
        (a, b) =>
          a.type.localeCompare(b.type) || b.versionNumber - a.versionNumber,
      )
      .map((document) =>
        toAdminResult(
          document,
          documents.filter((each) => each.type === document.type),
          nameById.get(document.createdBy ?? '') ?? null,
          now,
        ),
      );
  }

  /**
   * 새 판을 올린다. 판 번호는 같은 종류의 마지막 판보다 커야 한다.
   * 시행일을 주지 않으면 바로 시행한다.
   */
  async publish(input: {
    type: LegalDocumentType;
    version: string;
    title: string;
    body: string;
    effectiveAt?: Date;
    createdBy: string;
  }): Promise<AdminLegalDocumentResult> {
    const now = new Date();
    const existing = await this.repository.findByType(input.type);
    const document = LegalDocument.publish(
      randomUUID(),
      { ...input, effectiveAt: input.effectiveAt ?? now },
      now,
      existing,
    );
    await this.repository.save(document);
    const registrant = await this.userRepository.findById(input.createdBy);
    return toAdminResult(
      document,
      [...existing, document],
      registrant?.name ?? null,
      now,
    );
  }
}

function toAdminResult(
  document: LegalDocument,
  versions: LegalDocument[],
  createdByName: string | null,
  now: Date,
): AdminLegalDocumentResult {
  return {
    ...toLegalDocumentResult(document),
    id: document.id,
    status: document.statusAt(now, versions),
    createdAt: document.createdAt,
    createdByName,
  };
}
