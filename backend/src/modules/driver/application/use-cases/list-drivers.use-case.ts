import { Inject, Injectable } from '@nestjs/common';
import {
  PageQuery,
  toPageRequest,
} from '../../../../common/application/page.js';
import {
  USER_REPOSITORY,
  type UserRepository,
} from '../../../user/domain/repositories/user.repository.js';
import {
  DRIVER_DOCUMENT_REPOSITORY,
  type DriverDocumentRepository,
} from '../../domain/repositories/driver-support.repositories.js';
import {
  AdminDriverPageResult,
  toAdminDriverResult,
} from '../dto/driver.result.js';
import {
  DRIVER_REVIEW_QUERY,
  type DriverReviewFilter,
  type DriverReviewQuery,
} from '../ports/driver-review.query.js';

/** 기사 심사 목록 유스케이스 (운영자). 신청한 사람과 서류 상태를 함께 준다. */
@Injectable()
export class ListDriversUseCase {
  constructor(
    @Inject(DRIVER_REVIEW_QUERY)
    private readonly reviewQuery: DriverReviewQuery,
    @Inject(DRIVER_DOCUMENT_REPOSITORY)
    private readonly documentRepository: DriverDocumentRepository,
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepository,
  ) {}

  async execute(
    filter: DriverReviewFilter,
    page: PageQuery,
  ): Promise<AdminDriverPageResult> {
    const [{ items, total }, counts] = await Promise.all([
      this.reviewQuery.find(filter, toPageRequest(page)),
      this.reviewQuery.countByStatus(),
    ]);
    const applicantIds = items.map((driver) => driver.userId);
    const reviewerIds = items.flatMap(
      (driver) => driver.snapshot().reviewedBy ?? [],
    );
    const [users, documents] = await Promise.all([
      this.userRepository.findByIds([
        ...new Set([...applicantIds, ...reviewerIds]),
      ]),
      this.documentRepository.findByUserIds(applicantIds),
    ]);
    const userById = new Map(users.map((user) => [user.id, user]));
    return {
      items: items.map((driver) =>
        toAdminDriverResult(
          driver,
          documents.filter((document) => document.userId === driver.userId),
          userById.get(driver.userId) ?? null,
          userById.get(driver.snapshot().reviewedBy ?? '') ?? null,
        ),
      ),
      total,
      page: page.page,
      size: page.size,
      counts,
    };
  }
}
