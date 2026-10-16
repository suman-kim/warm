import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import {
  ConflictError,
  NotFoundError,
} from '../../../../common/domain/domain-error.js';
import { Store } from '../../../store/domain/store.entity.js';
import {
  STORE_REPOSITORY,
  type StoreRepository,
} from '../../../store/domain/store.repository.js';
import {
  DeliveryStore,
  StoreWallet,
} from '../../application/ports/store-wallet.port.js';

/** 잔액이 동시에 바뀌어 저장이 밀리면 이만큼 다시 읽어 시도한다. */
const RETRIES = 3;

/** 가게 조회·충전금 포트 구현체. 가게 컨텍스트의 저장소를 쓴다. */
@Injectable()
export class StoreWalletAdapter implements StoreWallet {
  constructor(
    @Inject(STORE_REPOSITORY)
    private readonly stores: StoreRepository,
  ) {}

  async findByOwner(ownerUserId: string): Promise<DeliveryStore | null> {
    return toDeliveryStore(await this.stores.findByOwner(ownerUserId));
  }

  async findById(storeId: string): Promise<DeliveryStore | null> {
    return toDeliveryStore(await this.stores.findById(storeId));
  }

  chargeDeliveryFee(
    storeId: string,
    orderId: string,
    amount: number,
    memo: string,
  ): Promise<void> {
    return this.change(storeId, (store, now) =>
      store.chargeDeliveryFee({
        entryId: randomUUID(),
        orderId,
        amount,
        memo,
        now,
      }),
    );
  }

  refundDeliveryFee(
    storeId: string,
    orderId: string,
    amount: number,
    memo: string,
  ): Promise<void> {
    return this.change(storeId, (store, now) =>
      store.refundDeliveryFee({
        entryId: randomUUID(),
        orderId,
        amount,
        memo,
        now,
      }),
    );
  }

  /** 가게를 읽어 바꾸고 저장한다. 그사이 다른 요청이 잔액을 바꿨으면 다시 읽어 시도한다. */
  private async change(
    storeId: string,
    apply: (store: Store, now: Date) => unknown,
  ): Promise<void> {
    for (let attempt = 1; ; attempt++) {
      const store = await this.stores.findById(storeId);
      if (!store) {
        throw new NotFoundError('STORE_NOT_FOUND', '가게를 찾을 수 없어요.');
      }
      apply(store, new Date());
      try {
        await this.stores.save(store);
        return;
      } catch (error) {
        const stale =
          error instanceof ConflictError && error.code === 'STALE_AGGREGATE';
        if (!stale || attempt >= RETRIES) throw error;
      }
    }
  }
}

function toDeliveryStore(store: Store | null): DeliveryStore | null {
  if (!store) return null;
  const s = store.snapshot();
  return {
    id: s.id,
    ownerUserId: s.ownerUserId,
    name: s.name,
    phone: s.phone,
    ...s.address,
    approved: store.isApproved,
    walletBalance: s.walletBalance,
  };
}
