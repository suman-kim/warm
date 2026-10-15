import { Inject, Injectable } from '@nestjs/common';
import {
  DOMAIN_EVENT_PUBLISHER,
  type DomainEventPublisher,
} from '../../../../common/application/domain-event-publisher.port.js';
import { NotFoundError } from '../../../../common/domain/domain-error.js';
import {
  USER_REPOSITORY,
  type UserRepository,
} from '../../../user/domain/repositories/user.repository.js';
import {
  DriverDocument,
  DriverDocumentType,
} from '../../domain/entities/driver-document.entity.js';
import { Driver } from '../../domain/entities/driver.entity.js';
import {
  DRIVER_DOCUMENT_REPOSITORY,
  type DriverDocumentRepository,
} from '../../domain/repositories/driver-support.repositories.js';
import {
  DRIVER_REPOSITORY,
  type DriverRepository,
} from '../../domain/repositories/driver.repository.js';
import {
  AdminDriverResult,
  toAdminDriverResult,
} from '../dto/driver.result.js';
import {
  DriverDocumentsUseCase,
  StoredFile,
} from './driver-documents.use-case.js';

/**
 * 기사 심사 유스케이스 (운영자). 신청 내용과 서류를 보고 승인하거나 반려한다.
 * 결과는 기사에게 푸시로 간다.
 */
@Injectable()
export class ReviewDriverUseCase {
  constructor(
    @Inject(DRIVER_REPOSITORY)
    private readonly driverRepository: DriverRepository,
    @Inject(DRIVER_DOCUMENT_REPOSITORY)
    private readonly documentRepository: DriverDocumentRepository,
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepository,
    @Inject(DOMAIN_EVENT_PUBLISHER)
    private readonly eventPublisher: DomainEventPublisher,
    private readonly driverDocumentsUseCase: DriverDocumentsUseCase,
  ) {}

  async detail(driverId: string): Promise<AdminDriverResult> {
    const driver = await this.load(driverId);
    return this.toDetail(
      driver,
      await this.documentRepository.findByUserId(driver.userId),
    );
  }

  async documentFile(
    driverId: string,
    type: DriverDocumentType,
  ): Promise<StoredFile> {
    const driver = await this.load(driverId);
    return this.driverDocumentsUseCase.file(driver.userId, type);
  }

  /** 승인. 올린 서류도 모두 확인된 것으로 표시한다. */
  async approve(
    driverId: string,
    reviewerId: string,
  ): Promise<AdminDriverResult> {
    const now = new Date();
    return this.decide(driverId, (driver, documents) => {
      driver.approve(now, reviewerId);
      documents.forEach((document) => document.approve(now));
    });
  }

  /**
   * 반려. [rejectedDocuments]에 적은 서류는 반려로, 나머지는 확인된 것으로 표시한다 —
   * 기사는 반려된 서류만 다시 올리면 된다.
   */
  async reject(
    driverId: string,
    reviewerId: string,
    reason: string,
    rejectedDocuments: DriverDocumentType[] = [],
  ): Promise<AdminDriverResult> {
    const now = new Date();
    return this.decide(driverId, (driver, documents) => {
      driver.reject(reason, now, reviewerId);
      for (const document of documents) {
        if (rejectedDocuments.includes(document.type)) {
          document.reject(reason.trim(), now);
        } else {
          document.approve(now);
        }
      }
    });
  }

  private async decide(
    driverId: string,
    decision: (driver: Driver, documents: DriverDocument[]) => void,
  ): Promise<AdminDriverResult> {
    const driver = await this.load(driverId);
    const documents = await this.documentRepository.findByUserId(driver.userId);
    decision(driver, documents);
    await this.driverRepository.save(driver);
    for (const document of documents) {
      await this.documentRepository.save(document);
    }
    await this.eventPublisher.publishAll(driver.pullDomainEvents());
    return this.toDetail(driver, documents);
  }

  private async load(driverId: string): Promise<Driver> {
    const driver = await this.driverRepository.findById(driverId);
    if (!driver) {
      throw new NotFoundError('DRIVER_NOT_FOUND', '기사를 찾을 수 없어요.');
    }
    return driver;
  }

  private async toDetail(
    driver: Driver,
    documents: DriverDocument[],
  ): Promise<AdminDriverResult> {
    const { reviewedBy } = driver.snapshot();
    const [applicant, reviewer] = await Promise.all([
      this.userRepository.findById(driver.userId),
      reviewedBy ? this.userRepository.findById(reviewedBy) : null,
    ]);
    return toAdminDriverResult(driver, documents, applicant, reviewer);
  }
}
