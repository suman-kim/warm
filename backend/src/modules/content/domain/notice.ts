import { InvalidArgumentError } from '../../../common/domain/domain-error.js';
import { Paged, PageRequest } from '../../../common/domain/pagination.js';

/** 공지를 볼 사람. */
export enum NoticeAudience {
  ALL = 'ALL',
  CUSTOMER = 'CUSTOMER',
  DRIVER = 'DRIVER',
}

/** 공지사항. 운영자가 올리고 고객 앱·기사 앱의 공지사항 화면에 보인다. */
export class Notice {
  constructor(
    readonly id: string,
    readonly title: string,
    readonly body: string,
    readonly audience: NoticeAudience,
    readonly publishedAt: Date,
    /** 올린 운영자 (회원 ID). 예전에 올린 공지는 null. */
    readonly authorId: string | null,
    private currentRemovedAt: Date | null,
  ) {}

  static publish(
    id: string,
    input: {
      title: string;
      body: string;
      audience: NoticeAudience;
      authorId: string | null;
    },
    now: Date,
  ): Notice {
    const title = input.title.trim();
    const body = input.body.trim();
    if (title.length < 1 || title.length > 100) {
      throw new InvalidArgumentError(
        'INVALID_NOTICE_TITLE',
        '공지 제목은 1~100자로 입력해 주세요.',
      );
    }
    if (body.length < 1 || body.length > 5000) {
      throw new InvalidArgumentError(
        'INVALID_NOTICE_BODY',
        '공지 내용은 1~5000자로 입력해 주세요.',
      );
    }
    return new Notice(
      id,
      title,
      body,
      input.audience,
      now,
      input.authorId,
      null,
    );
  }

  /** 내린 시각. 게시 중이면 null. */
  get removedAt(): Date | null {
    return this.currentRemovedAt;
  }

  /** 앱에 보이는 중인지. */
  get isLive(): boolean {
    return this.currentRemovedAt === null;
  }

  /** 공지를 내린다. 앱에서 바로 사라지고 기록으로 남는다. 이미 내린 공지면 그대로 둔다. */
  remove(now: Date): void {
    this.currentRemovedAt ??= now;
  }

  /** 이 대상에게 지금 보이는지. 내린 공지는 누구에게도 보이지 않는다. */
  isVisibleTo(audiences: NoticeAudience[]): boolean {
    return this.isLive && audiences.includes(this.audience);
  }
}

/** 공지 저장소 DI 토큰. */
export const NOTICE_REPOSITORY = Symbol('NOTICE_REPOSITORY');

/** 공지 저장소 계약. */
export interface NoticeRepository {
  save(notice: Notice): Promise<void>;
  findById(id: string): Promise<Notice | null>;
  /** 주어진 대상에게 보이는(게시 중인) 공지를 최근 것부터. */
  findByAudiences(
    audiences: NoticeAudience[],
    page: PageRequest,
  ): Promise<Paged<Notice>>;
  /** 운영자용 목록. 게시 중인 것 또는 내린 것을 최근에 올린 것부터. */
  findByState(live: boolean, page: PageRequest): Promise<Paged<Notice>>;
  countByState(): Promise<{ live: number; removed: number }>;
}
