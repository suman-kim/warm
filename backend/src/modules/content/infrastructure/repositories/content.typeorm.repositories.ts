import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, LessThanOrEqual, Not, Repository } from 'typeorm';
import { ConflictError } from '../../../../common/domain/domain-error.js';
import { Paged, PageRequest } from '../../../../common/domain/pagination.js';
import { isUniqueViolation } from '../../../../common/infrastructure/persistence/persist-aggregate.js';
import {
  LegalConsent,
  LegalConsentRepository,
} from '../../domain/legal-consent.js';
import {
  LegalDocument,
  LegalDocumentRepository,
  LegalDocumentType,
} from '../../domain/legal-document.js';
import {
  Notice,
  NoticeAudience,
  NoticeRepository,
} from '../../domain/notice.js';
import { LegalConsentOrmEntity } from '../entities/legal-consent.orm-entity.js';
import { LegalDocumentOrmEntity } from '../entities/legal-document.orm-entity.js';
import { NoticeOrmEntity } from '../entities/notice.orm-entity.js';

/** 공지 저장소 TypeORM 구현체. */
@Injectable()
export class NoticeTypeormRepository implements NoticeRepository {
  constructor(
    @InjectRepository(NoticeOrmEntity)
    private readonly repository: Repository<NoticeOrmEntity>,
  ) {}

  async save(notice: Notice): Promise<void> {
    await this.repository.save({
      id: notice.id,
      title: notice.title,
      body: notice.body,
      audience: notice.audience,
      publishedAt: notice.publishedAt,
      authorId: notice.authorId,
      removedAt: notice.removedAt,
    });
  }

  async findById(id: string): Promise<Notice | null> {
    const row = await this.repository.findOne({ where: { id } });
    return row ? toNotice(row) : null;
  }

  async findByAudiences(
    audiences: NoticeAudience[],
    page: PageRequest,
  ): Promise<Paged<Notice>> {
    const [rows, total] = await this.repository.findAndCount({
      where: { audience: In(audiences), removedAt: IsNull() },
      order: { publishedAt: 'DESC' },
      skip: page.offset,
      take: page.limit,
    });
    return { items: rows.map(toNotice), total };
  }

  async findByState(live: boolean, page: PageRequest): Promise<Paged<Notice>> {
    const [rows, total] = await this.repository.findAndCount({
      where: { removedAt: live ? IsNull() : Not(IsNull()) },
      order: { publishedAt: 'DESC' },
      skip: page.offset,
      take: page.limit,
    });
    return { items: rows.map(toNotice), total };
  }

  async countByState(): Promise<{ live: number; removed: number }> {
    const [live, removed] = await Promise.all([
      this.repository.count({ where: { removedAt: IsNull() } }),
      this.repository.count({ where: { removedAt: Not(IsNull()) } }),
    ]);
    return { live, removed };
  }
}

/** 약관 저장소 TypeORM 구현체. */
@Injectable()
export class LegalDocumentTypeormRepository implements LegalDocumentRepository {
  constructor(
    @InjectRepository(LegalDocumentOrmEntity)
    private readonly repository: Repository<LegalDocumentOrmEntity>,
  ) {}

  async save(document: LegalDocument): Promise<void> {
    try {
      await this.repository.insert({
        id: document.id,
        type: document.type,
        version: document.version,
        title: document.title,
        body: document.body,
        effectiveAt: document.effectiveAt,
        createdAt: document.createdAt,
        createdBy: document.createdBy,
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictError(
          'DUPLICATE_RESOURCE',
          '같은 판 번호의 문서가 이미 있어요.',
        );
      }
      throw error;
    }
  }

  async findCurrent(
    type: LegalDocumentType,
    now: Date,
  ): Promise<LegalDocument | null> {
    const row = await this.repository.findOne({
      where: { type, effectiveAt: LessThanOrEqual(now) },
      order: { effectiveAt: 'DESC', createdAt: 'DESC' },
    });
    return row ? toLegalDocument(row) : null;
  }

  async findByType(type: LegalDocumentType): Promise<LegalDocument[]> {
    const rows = await this.repository.find({ where: { type } });
    return rows.map(toLegalDocument);
  }

  async findAll(): Promise<LegalDocument[]> {
    const rows = await this.repository.find();
    return rows.map(toLegalDocument);
  }
}

function toLegalDocument(row: LegalDocumentOrmEntity): LegalDocument {
  return new LegalDocument(
    row.id,
    row.type as LegalDocumentType,
    row.version,
    row.title,
    row.body,
    row.effectiveAt,
    row.createdAt,
    row.createdBy,
  );
}

function toNotice(row: NoticeOrmEntity): Notice {
  return new Notice(
    row.id,
    row.title,
    row.body,
    row.audience as NoticeAudience,
    row.publishedAt,
    row.authorId,
    row.removedAt,
  );
}

/** 약관 동의 기록 저장소 TypeORM 구현체. */
@Injectable()
export class LegalConsentTypeormRepository implements LegalConsentRepository {
  constructor(
    @InjectRepository(LegalConsentOrmEntity)
    private readonly repository: Repository<LegalConsentOrmEntity>,
  ) {}

  async saveAll(consents: LegalConsent[]): Promise<void> {
    if (consents.length === 0) return;
    await this.repository.insert(consents.map((consent) => ({ ...consent })));
  }

  async findByUser(userId: string): Promise<LegalConsent[]> {
    const rows = await this.repository.find({
      where: { userId },
      order: { agreedAt: 'ASC' },
    });
    return rows.map((row) => ({
      id: row.id,
      userId: row.userId,
      type: row.type as LegalDocumentType,
      version: row.version,
      agreedAt: row.agreedAt,
    }));
  }
}
