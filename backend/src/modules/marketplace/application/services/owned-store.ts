import { Inject, Injectable } from '@nestjs/common';
import { NotFoundError } from '../../../../common/domain/domain-error.js';
import { Store } from '../../../store/domain/store.entity.js';
import {
  STORE_REPOSITORY,
  type StoreRepository,
} from '../../../store/domain/store.repository.js';
import { Storefront } from '../../domain/entities/storefront.entity.js';
import {
  STOREFRONT_REPOSITORY,
  type StorefrontRepository,
} from '../../domain/repositories/marketplace.repositories.js';

/** 사장님의 가게와 주문앱 가게를 찾는다. 주문앱 가게는 처음 열어 볼 때 기본 설정으로 만든다. */
@Injectable()
export class OwnedStore {
  constructor(
    @Inject(STORE_REPOSITORY)
    private readonly stores: StoreRepository,
    @Inject(STOREFRONT_REPOSITORY)
    private readonly storefronts: StorefrontRepository,
  ) {}

  async store(ownerUserId: string): Promise<Store> {
    const store = await this.stores.findByOwner(ownerUserId);
    if (!store) {
      throw new NotFoundError('STORE_NOT_FOUND', '가게를 먼저 등록해 주세요.');
    }
    return store;
  }

  async storefront(
    ownerUserId: string,
  ): Promise<{ store: Store; storefront: Storefront }> {
    const store = await this.store(ownerUserId);
    return { store, storefront: await this.storefrontOf(store.id) };
  }

  /** 아직 없으면 기본 설정의 새 주문앱 가게 (저장 전). */
  async storefrontOf(storeId: string): Promise<Storefront> {
    return (
      (await this.storefronts.findByStoreId(storeId)) ??
      Storefront.create(storeId, new Date())
    );
  }
}
