import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { PageQuery, toPageRequest } from '../../../common/application/page.js';
import { NotFoundError } from '../../../common/domain/domain-error.js';
import { UserRole } from '../../../common/domain/user-role.js';
import {
  USER_REPOSITORY,
  type UserRepository,
} from '../../user/domain/repositories/user.repository.js';
import {
  Notice,
  NOTICE_REPOSITORY,
  NoticeAudience,
  type NoticeRepository,
} from '../domain/notice.js';
import {
  AdminNoticePageResult,
  AdminNoticeResult,
  NoticePageResult,
  NoticeResult,
  toNoticeListItem,
  toNoticeResult,
} from './content.result.js';

/** 역할별로 볼 수 있는 공지 대상. 운영자는 전부 본다. */
const AUDIENCES_BY_ROLE: Record<UserRole, NoticeAudience[]> = {
  [UserRole.CUSTOMER]: [NoticeAudience.ALL, NoticeAudience.CUSTOMER],
  [UserRole.DRIVER]: [NoticeAudience.ALL, NoticeAudience.DRIVER],
  // 주문앱 손님 대상 공지는 아직 없다 — 전체 공지만 본다.
  [UserRole.CONSUMER]: [NoticeAudience.ALL],
  [UserRole.ADMIN]: Object.values(NoticeAudience),
};

/** 공지사항 유스케이스. 회원은 자기 앱에 해당하는, 게시 중인 공지만 본다. */
@Injectable()
export class NoticesUseCase {
  constructor(
    @Inject(NOTICE_REPOSITORY)
    private readonly repository: NoticeRepository,
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepository,
  ) {}

  async list(role: UserRole, page: PageQuery): Promise<NoticePageResult> {
    const { items, total } = await this.repository.findByAudiences(
      AUDIENCES_BY_ROLE[role],
      toPageRequest(page),
    );
    return {
      items: items.map(toNoticeListItem),
      total,
      page: page.page,
      size: page.size,
    };
  }

  async get(role: UserRole, id: string): Promise<NoticeResult> {
    const notice = await this.repository.findById(id);
    // 다른 앱 대상 공지와 내린 공지는 없는 것처럼 답한다.
    if (!notice?.isVisibleTo(AUDIENCES_BY_ROLE[role])) {
      throw new NotFoundError('NOTICE_NOT_FOUND', '공지를 찾을 수 없어요.');
    }
    return toNoticeResult(notice);
  }

  /** 운영자용 목록. 게시 중인 공지 또는 내린 공지. */
  async listForAdmin(
    live: boolean,
    page: PageQuery,
  ): Promise<AdminNoticePageResult> {
    const [{ items, total }, counts] = await Promise.all([
      this.repository.findByState(live, toPageRequest(page)),
      this.repository.countByState(),
    ]);
    const authors = await this.userRepository.findByIds([
      ...new Set(items.flatMap((notice) => notice.authorId ?? [])),
    ]);
    const nameById = new Map(authors.map((user) => [user.id, user.name]));
    return {
      items: items.map((notice) =>
        toAdminResult(notice, nameById.get(notice.authorId ?? '') ?? null),
      ),
      total,
      page: page.page,
      size: page.size,
      counts,
    };
  }

  async publish(input: {
    title: string;
    body: string;
    audience: NoticeAudience;
    authorId: string;
  }): Promise<AdminNoticeResult> {
    const notice = Notice.publish(randomUUID(), input, new Date());
    await this.repository.save(notice);
    const author = await this.userRepository.findById(input.authorId);
    return toAdminResult(notice, author?.name ?? null);
  }

  /** 공지를 내린다. 앱에서 바로 사라지고 운영자 화면에는 기록으로 남는다. */
  async remove(id: string): Promise<void> {
    const notice = await this.repository.findById(id);
    if (!notice) {
      throw new NotFoundError('NOTICE_NOT_FOUND', '공지를 찾을 수 없어요.');
    }
    notice.remove(new Date());
    await this.repository.save(notice);
  }
}

function toAdminResult(
  notice: Notice,
  authorName: string | null,
): AdminNoticeResult {
  return { ...toNoticeResult(notice), authorName, removedAt: notice.removedAt };
}
