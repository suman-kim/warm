import {
  LegalDocument,
  LegalDocumentStatus,
  LegalDocumentType,
} from '../domain/legal-document.js';
import { Notice, NoticeAudience } from '../domain/notice.js';

/** 공지 목록의 한 줄. 본문은 상세에서 준다. */
export class NoticeListItemResult {
  id: string;
  title: string;
  audience: NoticeAudience;
  publishedAt: Date;
}

/** 공지 상세 응답. */
export class NoticeResult extends NoticeListItemResult {
  body: string;
}

export class NoticePageResult {
  items: NoticeListItemResult[];
  total: number;
  page: number;
  size: number;
}

/** 운영자가 보는 공지. 올린 사람과 내린 시각이 붙는다. */
export class AdminNoticeResult extends NoticeResult {
  authorName: string | null;
  /** 내린 시각. 게시 중이면 null. */
  removedAt: Date | null;
}

export class AdminNoticePageResult {
  items: AdminNoticeResult[];
  total: number;
  page: number;
  size: number;
  /** 탭에 보이는 건수 */
  counts: { live: number; removed: number };
}

/** 약관 목록의 한 줄. 본문은 상세에서 준다. */
export class LegalDocumentSummaryResult {
  type: LegalDocumentType;
  /** 판 번호 */
  version: string;
  title: string;
  /** 시행일 */
  effectiveAt: Date;
}

/** 약관 상세 응답. */
export class LegalDocumentResult extends LegalDocumentSummaryResult {
  body: string;
}

/** 운영자가 보는 약관의 한 판. */
export class AdminLegalDocumentResult extends LegalDocumentResult {
  id: string;
  status: LegalDocumentStatus;
  /** 등록일 */
  createdAt: Date;
  /** 등록한 운영자의 이름 */
  createdByName: string | null;
}

/** 고객센터 연락처 응답. 설정하지 않은 값은 null. */
export class SupportContactResult {
  /** 전화번호 (예: 1588-0000) */
  phone: string | null;
  email: string | null;
  /** 운영 시간 안내 (예: 평일 09:00~18:00) */
  hours: string | null;
  /** 카카오톡 채널 주소 */
  kakaoChannelUrl: string | null;
}

/** 사업자 정보 (전자상거래법 표시 의무). 서버 환경변수(BUSINESS_*)에 적은 값이다. */
export class BusinessInfoResult {
  /** 상호 */
  name: string | null;
  /** 대표자 */
  representative: string | null;
  /** 사업자등록번호 (예: 214-88-01234) */
  registrationNumber: string | null;
  /** 통신판매업 신고번호 */
  mailOrderNumber: string | null;
  address: string | null;
  /** 고객센터 전화 */
  phone: string | null;
  /** 고객센터 운영 시간 */
  hours: string | null;
  email: string | null;
}

export function toNoticeListItem(notice: Notice): NoticeListItemResult {
  return {
    id: notice.id,
    title: notice.title,
    audience: notice.audience,
    publishedAt: notice.publishedAt,
  };
}

export function toNoticeResult(notice: Notice): NoticeResult {
  return { ...toNoticeListItem(notice), body: notice.body };
}

export function toLegalDocumentSummary(
  document: LegalDocument,
): LegalDocumentSummaryResult {
  return {
    type: document.type,
    version: document.version,
    title: document.title,
    effectiveAt: document.effectiveAt,
  };
}

export function toLegalDocumentResult(
  document: LegalDocument,
): LegalDocumentResult {
  return { ...toLegalDocumentSummary(document), body: document.body };
}
