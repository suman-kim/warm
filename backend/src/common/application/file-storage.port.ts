/** 파일 보관소 DI 토큰. */
export const FILE_STORAGE = Symbol('FILE_STORAGE');

/**
 * 올린 파일을 두는 곳. 기본 구현은 서버의 디스크이고, 운영에서는 객체 저장소(S3 등)
 * 구현으로 바꿔 끼운다.
 */
export interface FileStorage {
  save(key: string, bytes: Buffer, contentType: string): Promise<void>;
  /** 없으면 null. */
  read(key: string): Promise<Buffer | null>;
  /** 없어도 실패하지 않는다. */
  delete(key: string): Promise<void>;
}
