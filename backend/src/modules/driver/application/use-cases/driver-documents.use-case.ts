import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import {
  FILE_STORAGE,
  type FileStorage,
} from '../../../../common/application/file-storage.port.js';
import { NotFoundError } from '../../../../common/domain/domain-error.js';
import {
  detectDocumentContentType,
  DriverDocument,
  DriverDocumentType,
} from '../../domain/entities/driver-document.entity.js';
import {
  DRIVER_DOCUMENT_REPOSITORY,
  type DriverDocumentRepository,
} from '../../domain/repositories/driver-support.repositories.js';
import {
  DriverDocumentResult,
  toDocumentResults,
} from '../dto/driver.result.js';

/** 보관해 둔 서류 파일. */
export interface StoredFile {
  bytes: Buffer;
  contentType: string;
}

/** 기사 서류 유스케이스. 등록 신청 전에(그리고 반려된 뒤에) 서류를 올린다. */
@Injectable()
export class DriverDocumentsUseCase {
  constructor(
    @Inject(DRIVER_DOCUMENT_REPOSITORY)
    private readonly documentRepository: DriverDocumentRepository,
    @Inject(FILE_STORAGE)
    private readonly fileStorage: FileStorage,
  ) {}

  /** 서류 한 종류를 올린다. 이미 올린 종류면 새 파일로 바꾼다. 형식은 파일 내용으로 판단한다. */
  async upload(
    userId: string,
    type: DriverDocumentType,
    bytes: Buffer,
  ): Promise<DriverDocumentResult[]> {
    const document = DriverDocument.upload({
      id: randomUUID(),
      userId,
      type,
      contentType: detectDocumentContentType(bytes),
      size: bytes.length,
      now: new Date(),
    });
    const previous = await this.documentRepository.findOne(userId, type);
    await this.fileStorage.save(
      document.storageKey,
      bytes,
      document.contentType,
    );
    await this.documentRepository.save(document);
    if (previous) {
      await this.fileStorage.delete(previous.storageKey);
    }
    return this.list(userId);
  }

  /** 필요한 서류 전부의 상태. 아직 올리지 않은 것도 포함한다. */
  async list(userId: string): Promise<DriverDocumentResult[]> {
    return toDocumentResults(
      await this.documentRepository.findByUserId(userId),
    );
  }

  /** 올린 파일을 그대로 돌려준다. */
  async file(userId: string, type: DriverDocumentType): Promise<StoredFile> {
    const document = await this.documentRepository.findOne(userId, type);
    const bytes =
      document && (await this.fileStorage.read(document.storageKey));
    if (!document || !bytes) {
      throw new NotFoundError('DOCUMENT_NOT_FOUND', '서류를 찾을 수 없어요.');
    }
    return { bytes, contentType: document.contentType };
  }
}
