import { InvalidArgumentError } from '../../../common/domain/domain-error.js';

/** 약관·정책의 종류. */
export enum LegalDocumentType {
  /** 서비스 이용약관 */
  TERMS = 'TERMS',
  /** 개인정보 처리방침 */
  PRIVACY = 'PRIVACY',
  /** 위치기반서비스 이용약관 */
  LOCATION = 'LOCATION',
  /** 취소·환불 규정 */
  REFUND = 'REFUND',
  /** 기사 운송 약관 — 기사 앱에만 보인다 */
  DRIVER = 'DRIVER',
  /** 마케팅 정보 수신 동의 */
  MARKETING = 'MARKETING',
}

/**
 * 약관·정책 문서의 한 판(版).
 * 고친 내용은 새 판으로 올린다 — 회원이 동의한 지난 판이 남아 있어야 하기 때문에 덮어쓰지 않는다.
 */
export class LegalDocument {
  constructor(
    readonly id: string,
    readonly type: LegalDocumentType,
    /** 판 번호. 1부터 올라가는 숫자이고 같은 종류 안에서 겹치지 않는다. */
    readonly version: string,
    readonly title: string,
    readonly body: string,
    /** 시행일. 이 시각부터 이 판이 보인다. */
    readonly effectiveAt: Date,
    readonly createdAt: Date,
    /** 올린 운영자 (회원 ID). 예전에 올린 문서는 null. */
    readonly createdBy: string | null,
  ) {}

  /** 판 번호를 숫자로. 숫자가 아닌 예전 판은 0으로 본다. */
  get versionNumber(): number {
    return /^\d+$/.test(this.version) ? Number(this.version) : 0;
  }

  /** [now]에 이 판이 어떤 상태인지. [versions]는 같은 종류의 모든 판. */
  statusAt(now: Date, versions: LegalDocument[]): LegalDocumentStatus {
    if (this.effectiveAt > now) {
      return LegalDocumentStatus.SCHEDULED;
    }
    return currentOf(versions, now)?.id === this.id
      ? LegalDocumentStatus.CURRENT
      : LegalDocumentStatus.PAST;
  }

  static publish(
    id: string,
    input: {
      type: LegalDocumentType;
      version: string;
      title: string;
      body: string;
      effectiveAt: Date;
      createdBy: string | null;
    },
    now: Date,
    /** 같은 종류로 이미 올라온 판들. 새 판의 번호는 이들보다 커야 한다. */
    existing: LegalDocument[] = [],
  ): LegalDocument {
    const version = input.version.trim();
    const title = input.title.trim();
    if (!/^[1-9]\d{0,5}$/.test(version)) {
      throw new InvalidArgumentError(
        'INVALID_DOCUMENT_VERSION',
        '판 번호는 1 이상의 숫자로 입력해 주세요.',
      );
    }
    const latest = Math.max(0, ...existing.map((each) => each.versionNumber));
    if (Number(version) <= latest) {
      throw new InvalidArgumentError(
        'DOCUMENT_VERSION_NOT_NEWER',
        `판 번호는 v${latest + 1} 이상이어야 해요.`,
      );
    }
    if (title.length < 1 || title.length > 100) {
      throw new InvalidArgumentError(
        'INVALID_DOCUMENT_TITLE',
        '문서 제목은 1~100자로 입력해 주세요.',
      );
    }
    if (input.body.trim().length < 1) {
      throw new InvalidArgumentError(
        'INVALID_DOCUMENT_BODY',
        '문서 내용을 입력해 주세요.',
      );
    }
    return new LegalDocument(
      id,
      input.type,
      version,
      title,
      input.body,
      input.effectiveAt,
      now,
      input.createdBy,
    );
  }
}

export enum LegalDocumentStatus {
  /** 지금 앱에 보이는 판 */
  CURRENT = 'CURRENT',
  /** 시행일이 아직 오지 않은 판 */
  SCHEDULED = 'SCHEDULED',
  /** 새 판으로 바뀐 지난 판 */
  PAST = 'PAST',
}

/** [now]에 시행 중인 판 — 시행일이 지난 것 중 가장 늦게 시행된 것. */
export function currentOf(
  versions: LegalDocument[],
  now: Date,
): LegalDocument | null {
  return (
    versions
      .filter((each) => each.effectiveAt <= now)
      .sort(
        (a, b) =>
          b.effectiveAt.getTime() - a.effectiveAt.getTime() ||
          b.createdAt.getTime() - a.createdAt.getTime(),
      )[0] ?? null
  );
}

/** 약관 저장소 DI 토큰. */
export const LEGAL_DOCUMENT_REPOSITORY = Symbol('LEGAL_DOCUMENT_REPOSITORY');

/** 약관 저장소 계약. */
export interface LegalDocumentRepository {
  /** 같은 종류에 같은 판 번호가 이미 있으면 ConflictError(DUPLICATE_RESOURCE). */
  save(document: LegalDocument): Promise<void>;
  /** 지금 시행 중인 판 — 시행일이 지난 것 중 가장 최근 것. 없으면 null. */
  findCurrent(
    type: LegalDocumentType,
    now: Date,
  ): Promise<LegalDocument | null>;
  /** 한 종류의 모든 판. */
  findByType(type: LegalDocumentType): Promise<LegalDocument[]>;
  /** 모든 종류의 모든 판 (운영자용). */
  findAll(): Promise<LegalDocument[]>;
}
