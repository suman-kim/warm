import {
  ConflictError,
  InvalidArgumentError,
} from '../../../../common/domain/domain-error.js';

/** 기사 등록에 내는 서류. */
export enum DriverDocumentType {
  /** 운전면허증 */
  DRIVER_LICENSE = 'DRIVER_LICENSE',
  /** 자동차등록증 */
  VEHICLE_REGISTRATION = 'VEHICLE_REGISTRATION',
  /** 화물운송 종사 자격증 */
  FREIGHT_QUALIFICATION = 'FREIGHT_QUALIFICATION',
}

export enum DriverDocumentStatus {
  /** 올렸고 아직 심사 전 */
  SUBMITTED = 'SUBMITTED',
  APPROVED = 'APPROVED',
  /** 반려됨 — 다시 올려야 한다 */
  REJECTED = 'REJECTED',
}

// TODO: 차종과 무관하게 세 가지를 모두 받는다. 차종별로 필요한 서류가 달라지면 여기를 바꾼다.
export const REQUIRED_DOCUMENTS: readonly DriverDocumentType[] =
  Object.values(DriverDocumentType);

export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;

const EXTENSION_BY_CONTENT_TYPE: Readonly<Record<string, string>> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'application/pdf': 'pdf',
};

/**
 * 파일 내용의 앞머리(매직 넘버)로 형식을 알아낸다. 받지 않는 형식이면 null.
 * 클라이언트가 보낸 Content-Type은 믿지 않는다 — 틀리게 오거나 꾸며낼 수 있다.
 */
export function detectDocumentContentType(bytes: Uint8Array): string | null {
  const startsWith = (signature: number[], offset = 0) =>
    signature.every((byte, index) => bytes[offset + index] === byte);
  const ascii = (text: string) => [...text].map((char) => char.charCodeAt(0));

  if (startsWith([0xff, 0xd8, 0xff])) {
    return 'image/jpeg';
  }
  if (startsWith([0x89, ...ascii('PNG'), 0x0d, 0x0a, 0x1a, 0x0a])) {
    return 'image/png';
  }
  if (startsWith(ascii('RIFF')) && startsWith(ascii('WEBP'), 8)) {
    return 'image/webp';
  }
  if (startsWith(ascii('%PDF-'))) {
    return 'application/pdf';
  }
  // HEIC는 ISO 미디어 파일이다: 4바이트 길이, 'ftyp', 그다음에 브랜드.
  if (startsWith(ascii('ftyp'), 4)) {
    const brand = String.fromCharCode(...bytes.subarray(8, 12));
    if (['heic', 'heix', 'heim', 'heis', 'mif1', 'msf1'].includes(brand)) {
      return 'image/heic';
    }
  }
  return null;
}

/**
 * 기사가 올린 서류 한 장. 기사 등록 신청 전에(계정만 있을 때) 올리므로 회원에 묶인다.
 * 같은 종류를 다시 올리면 앞의 것을 대신한다.
 */
export class DriverDocument {
  constructor(
    readonly id: string,
    readonly userId: string,
    readonly type: DriverDocumentType,
    private currentStatus: DriverDocumentStatus,
    /** 보관소에서 파일을 찾는 키 */
    readonly storageKey: string,
    readonly contentType: string,
    readonly size: number,
    private currentRejectionReason: string | null,
    readonly uploadedAt: Date,
    private currentReviewedAt: Date | null,
  ) {}

  static upload(input: {
    id: string;
    userId: string;
    type: DriverDocumentType;
    /** 파일 형식. detectDocumentContentType으로 알아낸 값을 준다. 받지 않는 형식이면 null. */
    contentType: string | null;
    size: number;
    now: Date;
  }): DriverDocument {
    const extension =
      input.contentType && EXTENSION_BY_CONTENT_TYPE[input.contentType];
    if (!input.contentType || !extension) {
      throw new InvalidArgumentError(
        'UNSUPPORTED_DOCUMENT_TYPE',
        '사진(JPG·PNG·WEBP·HEIC)이나 PDF만 올릴 수 있어요.',
      );
    }
    if (input.size <= 0 || input.size > MAX_DOCUMENT_BYTES) {
      throw new InvalidArgumentError(
        'DOCUMENT_TOO_LARGE',
        '파일은 10MB까지 올릴 수 있어요.',
      );
    }
    return new DriverDocument(
      input.id,
      input.userId,
      input.type,
      DriverDocumentStatus.SUBMITTED,
      `driver-documents/${input.userId}/${input.type}-${input.id}.${extension}`,
      input.contentType,
      input.size,
      null,
      input.now,
      null,
    );
  }

  get status(): DriverDocumentStatus {
    return this.currentStatus;
  }

  get rejectionReason(): string | null {
    return this.currentRejectionReason;
  }

  get reviewedAt(): Date | null {
    return this.currentReviewedAt;
  }

  approve(now: Date): void {
    this.currentStatus = DriverDocumentStatus.APPROVED;
    this.currentRejectionReason = null;
    this.currentReviewedAt = now;
  }

  reject(reason: string, now: Date): void {
    this.currentStatus = DriverDocumentStatus.REJECTED;
    this.currentRejectionReason = reason;
    this.currentReviewedAt = now;
  }
}

/**
 * 신청에 필요한 서류가 모두 준비됐는지 확인한다.
 * 빠졌거나 반려된 채로 남은 서류가 있으면 ConflictError.
 */
export function assertDocumentsReady(documents: DriverDocument[]): void {
  const ready = new Set(
    documents
      .filter((document) => document.status !== DriverDocumentStatus.REJECTED)
      .map((document) => document.type),
  );
  const missing = REQUIRED_DOCUMENTS.filter((type) => !ready.has(type));
  if (missing.length > 0) {
    throw new ConflictError(
      'DOCUMENTS_REQUIRED',
      `서류 ${missing.length}개를 더 올리면 신청할 수 있어요.`,
    );
  }
}
