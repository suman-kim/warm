import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FileStorage } from '../../application/file-storage.port.js';

/**
 * 서버의 디스크에 파일을 두는 보관소 (UPLOAD_DIR, 기본 ./uploads).
 * 서버가 한 대일 때만 맞다 — 여러 대로 늘리거나 디스크가 지워지는 환경이면
 * 객체 저장소 구현으로 바꾼다.
 */
@Injectable()
export class LocalFileStorage implements FileStorage {
  private readonly root: string;

  constructor(config: ConfigService) {
    this.root = resolve(config.getOrThrow<string>('UPLOAD_DIR'));
  }

  async save(key: string, bytes: Buffer): Promise<void> {
    const path = this.pathOf(key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, bytes);
  }

  async read(key: string): Promise<Buffer | null> {
    try {
      return await readFile(this.pathOf(key));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }

  async delete(key: string): Promise<void> {
    await rm(this.pathOf(key), { force: true });
  }

  private pathOf(key: string): string {
    const path = resolve(this.root, key);
    // 키에 '..'가 섞여도 보관 폴더 밖을 건드리지 않는다.
    if (!path.startsWith(this.root + sep)) {
      throw new Error(`보관 폴더 밖의 경로예요: ${key}`);
    }
    return path;
  }
}
