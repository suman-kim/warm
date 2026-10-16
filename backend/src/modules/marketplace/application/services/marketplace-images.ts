import { randomUUID } from 'node:crypto';
import { InvalidArgumentError } from '../../../../common/domain/domain-error.js';
import {
  detectImageContentType,
  IMAGE_EXTENSIONS,
} from '../../../../common/domain/image-type.js';

/** 가게 대표 사진·메뉴 사진 한 장의 한도 */
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

const FILE_NAME = /^[0-9a-f-]{36}\.(jpg|png|webp)$/;

/** 올린 사진을 확인하고 보관소 키를 정한다: storefront/{가게 ID}/{새 ID}.{확장자} */
export function newImage(
  storeId: string,
  bytes: Buffer,
): { key: string; contentType: string } {
  if (bytes.length === 0 || bytes.length > MAX_IMAGE_BYTES) {
    throw new InvalidArgumentError(
      'INVALID_IMAGE',
      '사진은 5MB까지 올릴 수 있어요.',
    );
  }
  const contentType = detectImageContentType(bytes);
  if (!contentType) {
    throw new InvalidArgumentError(
      'INVALID_IMAGE',
      'JPG, PNG, WEBP 사진만 올릴 수 있어요.',
    );
  }
  return {
    key: `storefront/${storeId}/${randomUUID()}.${IMAGE_EXTENSIONS[contentType]}`,
    contentType,
  };
}

/** 사진을 내려받는 주소 (/api부터). 손님 앱은 로그인 없이 받는다. */
export function imageUrl(key: string | null): string | null {
  if (!key) return null;
  const [, storeId, file] = key.split('/');
  return `/api/storefronts/${storeId}/images/${file}`;
}

/** 주소의 파일 이름을 보관소 키로. 형식이 틀리면 null. */
export function imageKey(storeId: string, file: string): string | null {
  return FILE_NAME.test(file) ? `storefront/${storeId}/${file}` : null;
}

export function contentTypeOf(file: string): string {
  const extension = file.split('.').pop();
  return (
    Object.entries(IMAGE_EXTENSIONS).find(
      ([, ext]) => ext === extension,
    )?.[0] ?? 'application/octet-stream'
  );
}
