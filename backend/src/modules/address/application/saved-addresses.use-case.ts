import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import {
  ConflictError,
  NotFoundError,
} from '../../../common/domain/domain-error.js';
import {
  MAX_SAVED_ADDRESSES,
  SAVED_ADDRESS_REPOSITORY,
  SavedAddress,
  type SavedAddressInput,
  type SavedAddressRepository,
} from '../domain/saved-address.js';
import {
  SavedAddressResult,
  toSavedAddressResult,
} from './saved-address.result.js';

/** 자주 쓰는 주소 유스케이스. 목록·추가·수정·삭제. */
@Injectable()
export class SavedAddressesUseCase {
  constructor(
    @Inject(SAVED_ADDRESS_REPOSITORY)
    private readonly repository: SavedAddressRepository,
  ) {}

  async list(userId: string): Promise<SavedAddressResult[]> {
    return (await this.repository.findByUser(userId)).map(toSavedAddressResult);
  }

  async add(
    userId: string,
    input: SavedAddressInput,
  ): Promise<SavedAddressResult> {
    if ((await this.repository.countByUser(userId)) >= MAX_SAVED_ADDRESSES) {
      throw new ConflictError(
        'TOO_MANY_SAVED_ADDRESSES',
        `주소는 ${MAX_SAVED_ADDRESSES}곳까지 저장할 수 있어요.`,
      );
    }
    const address = SavedAddress.create(
      randomUUID(),
      userId,
      input,
      new Date(),
    );
    await this.repository.save(address);
    return toSavedAddressResult(address);
  }

  /** 내용을 통째로 바꾼다. */
  async replace(
    userId: string,
    id: string,
    input: SavedAddressInput,
  ): Promise<SavedAddressResult> {
    const existing = await this.repository.findOne(userId, id);
    if (!existing) {
      throw new NotFoundError(
        'SAVED_ADDRESS_NOT_FOUND',
        '주소를 찾을 수 없어요.',
      );
    }
    const address = SavedAddress.create(id, userId, input, existing.createdAt);
    await this.repository.save(address);
    return toSavedAddressResult(address);
  }

  remove(userId: string, id: string): Promise<void> {
    return this.repository.delete(userId, id);
  }
}
