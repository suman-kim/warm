import {
  ConflictError,
  InvalidArgumentError,
} from '../../../../common/domain/domain-error.js';
import {
  assertDocumentsReady,
  detectDocumentContentType,
  DriverDocument,
  DriverDocumentStatus,
  DriverDocumentType,
  MAX_DOCUMENT_BYTES,
} from './driver-document.entity.js';

const NOW = new Date('2026-10-13T09:00:00Z');

const upload = (
  type: DriverDocumentType,
  overrides: { contentType?: string | null; size?: number } = {},
) =>
  DriverDocument.upload({
    id: `doc-${type}`,
    userId: 'user-1',
    type,
    contentType: 'image/jpeg',
    size: 1024,
    now: NOW,
    ...overrides,
  });

const allDocuments = () =>
  Object.values(DriverDocumentType).map((t) => upload(t));

describe('DriverDocument', () => {
  it('올리면 심사 전 상태이고, 보관 키에 회원과 종류가 들어간다', () => {
    const document = upload(DriverDocumentType.DRIVER_LICENSE);

    expect(document.status).toBe(DriverDocumentStatus.SUBMITTED);
    expect(document.storageKey).toBe(
      'driver-documents/user-1/DRIVER_LICENSE-doc-DRIVER_LICENSE.jpg',
    );
  });

  it('사진과 PDF만 받는다', () => {
    expect(() =>
      upload(DriverDocumentType.DRIVER_LICENSE, {
        contentType: 'application/zip',
      }),
    ).toThrow(InvalidArgumentError);
    expect(() =>
      upload(DriverDocumentType.DRIVER_LICENSE, { contentType: null }),
    ).toThrow(InvalidArgumentError);
    expect(() =>
      upload(DriverDocumentType.DRIVER_LICENSE, {
        contentType: 'application/pdf',
      }),
    ).not.toThrow();
  });

  it('10MB를 넘거나 빈 파일은 받지 않는다', () => {
    expect(() =>
      upload(DriverDocumentType.DRIVER_LICENSE, {
        size: MAX_DOCUMENT_BYTES + 1,
      }),
    ).toThrow(InvalidArgumentError);
    expect(() =>
      upload(DriverDocumentType.DRIVER_LICENSE, { size: 0 }),
    ).toThrow(InvalidArgumentError);
    expect(() =>
      upload(DriverDocumentType.DRIVER_LICENSE, { size: MAX_DOCUMENT_BYTES }),
    ).not.toThrow();
  });

  it('반려했다가 승인하면 반려 사유가 지워진다', () => {
    const document = upload(DriverDocumentType.DRIVER_LICENSE);
    document.reject('글자가 흐려요', NOW);
    expect(document.rejectionReason).toBe('글자가 흐려요');

    document.approve(NOW);

    expect(document.status).toBe(DriverDocumentStatus.APPROVED);
    expect(document.rejectionReason).toBeNull();
  });
});

describe('detectDocumentContentType', () => {
  const bytes = (...parts: (string | number[])[]) =>
    Uint8Array.from(
      parts.flatMap((part) =>
        typeof part === 'string'
          ? [...part].map((char) => char.charCodeAt(0))
          : part,
      ),
    );

  it.each([
    ['image/jpeg', bytes([0xff, 0xd8, 0xff, 0xe0], 'JFIF')],
    ['image/png', bytes([0x89], 'PNG', [0x0d, 0x0a, 0x1a, 0x0a])],
    ['image/webp', bytes('RIFF', [0x24, 0, 0, 0], 'WEBPVP8 ')],
    ['image/heic', bytes([0, 0, 0, 0x18], 'ftypheic')],
    ['application/pdf', bytes('%PDF-1.7')],
  ])('파일 앞머리로 %s 를 알아본다', (contentType, content) => {
    expect(detectDocumentContentType(content)).toBe(contentType);
  });

  it('받지 않는 형식은 null', () => {
    expect(detectDocumentContentType(bytes('PK', [3, 4]))).toBeNull();
    expect(detectDocumentContentType(bytes('<html>'))).toBeNull();
    // 동영상(mp4)도 'ftyp'으로 시작하지만 브랜드가 다르다.
    expect(
      detectDocumentContentType(bytes([0, 0, 0, 0x18], 'ftypisom')),
    ).toBeNull();
    expect(detectDocumentContentType(new Uint8Array())).toBeNull();
  });
});

describe('assertDocumentsReady', () => {
  it('세 가지를 모두 올렸으면 통과한다', () => {
    expect(() => assertDocumentsReady(allDocuments())).not.toThrow();
  });

  it('빠진 서류가 있으면 신청할 수 없다', () => {
    expect(() => assertDocumentsReady(allDocuments().slice(1))).toThrow(
      ConflictError,
    );
    expect(() => assertDocumentsReady([])).toThrow(ConflictError);
  });

  it('반려된 서류는 다시 올리기 전까지 없는 것으로 본다', () => {
    const documents = allDocuments();
    documents[0].reject('만료된 면허증이에요', NOW);

    expect(() => assertDocumentsReady(documents)).toThrow(ConflictError);
  });
});
