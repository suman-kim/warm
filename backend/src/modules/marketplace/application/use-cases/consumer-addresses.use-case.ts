import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import {
  ConflictError,
  NotFoundError,
} from '../../../../common/domain/domain-error.js';
import {
  ConsumerAddress,
  consumerAddress,
  MAX_CONSUMER_ADDRESSES,
} from '../../domain/entities/consumer-address.entity.js';
import {
  CONSUMER_ADDRESS_REPOSITORY,
  type ConsumerAddressRepository,
} from '../../domain/repositories/marketplace.repositories.js';
import { ConsumerAddressResult } from '../dto/marketplace.result.js';

export interface ConsumerAddressCommand {
  label: string;
  address: string;
  detailAddress?: string | null;
  sigungu?: string | null;
  dong?: string | null;
  latitude: number;
  longitude: number;
  isDefault?: boolean;
}

/** 손님의 배달 주소 (집, 회사…). 처음 저장한 주소가 기본 주소가 된다. */
@Injectable()
export class ConsumerAddressesUseCase {
  constructor(
    @Inject(CONSUMER_ADDRESS_REPOSITORY)
    private readonly addresses: ConsumerAddressRepository,
  ) {}

  async list(userId: string): Promise<ConsumerAddressResult[]> {
    return (await this.addresses.findByUser(userId)).map(toResult);
  }

  async add(
    userId: string,
    command: ConsumerAddressCommand,
  ): Promise<ConsumerAddressResult[]> {
    const existing = await this.addresses.findByUser(userId);
    if (existing.length >= MAX_CONSUMER_ADDRESSES) {
      throw new ConflictError(
        'TOO_MANY_ADDRESSES',
        `주소는 ${MAX_CONSUMER_ADDRESSES}개까지 저장할 수 있어요.`,
      );
    }
    await this.addresses.save(
      consumerAddress({
        id: randomUUID(),
        userId,
        label: command.label,
        address: command.address,
        detailAddress: command.detailAddress,
        sigungu: command.sigungu ?? null,
        dong: command.dong ?? null,
        latitude: command.latitude,
        longitude: command.longitude,
        isDefault: existing.length === 0 || (command.isDefault ?? false),
        createdAt: new Date(),
      }),
    );
    return this.list(userId);
  }

  async update(
    userId: string,
    addressId: string,
    command: ConsumerAddressCommand,
  ): Promise<ConsumerAddressResult[]> {
    const current = await this.owned(userId, addressId);
    await this.addresses.save(
      consumerAddress({
        ...current,
        label: command.label,
        address: command.address,
        detailAddress: command.detailAddress,
        sigungu: command.sigungu ?? null,
        dong: command.dong ?? null,
        latitude: command.latitude,
        longitude: command.longitude,
        // 기본 주소는 다른 주소를 기본으로 정해야 풀린다.
        isDefault: current.isDefault || (command.isDefault ?? false),
      }),
    );
    return this.list(userId);
  }

  async makeDefault(
    userId: string,
    addressId: string,
  ): Promise<ConsumerAddressResult[]> {
    const current = await this.owned(userId, addressId);
    await this.addresses.save({ ...current, isDefault: true });
    return this.list(userId);
  }

  /** 기본 주소를 지우면 남은 주소 중 가장 최근 것이 기본이 된다. */
  async remove(
    userId: string,
    addressId: string,
  ): Promise<ConsumerAddressResult[]> {
    const current = await this.owned(userId, addressId);
    await this.addresses.delete(current.id);
    if (current.isDefault) {
      const [next] = await this.addresses.findByUser(userId);
      if (next) await this.addresses.save({ ...next, isDefault: true });
    }
    return this.list(userId);
  }

  private async owned(
    userId: string,
    addressId: string,
  ): Promise<ConsumerAddress> {
    const address = await this.addresses.findById(addressId);
    if (!address || address.userId !== userId) {
      throw new NotFoundError('ADDRESS_NOT_FOUND', '주소를 찾을 수 없어요.');
    }
    return address;
  }
}

function toResult(address: ConsumerAddress): ConsumerAddressResult {
  const { userId: _userId, ...rest } = address;
  return rest;
}
