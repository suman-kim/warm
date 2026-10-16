import { Inject, Injectable } from '@nestjs/common';
import { NotFoundError } from '../../../../common/domain/domain-error.js';
import { Store } from '../../../store/domain/store.entity.js';
import {
  STORE_REPOSITORY,
  type StoreRepository,
} from '../../../store/domain/store.repository.js';
import {
  MENU_REPOSITORY,
  type MenuRepository,
  STOREFRONT_REPOSITORY,
  type StorefrontRepository,
} from '../../domain/repositories/marketplace.repositories.js';
import { AdminStorefrontResult } from '../dto/marketplace.result.js';
import { OwnedStore } from '../services/owned-store.js';
import {
  menuResult,
  myStorefrontResult,
} from '../services/storefront-views.js';

/** 운영자의 입점 검수: 가게의 주문앱 설정·메뉴·사진을 보고, 문제가 있으면 손님 앱에서 내린다. */
@Injectable()
export class AdminStorefrontsUseCase {
  constructor(
    private readonly owned: OwnedStore,
    @Inject(STORE_REPOSITORY)
    private readonly stores: StoreRepository,
    @Inject(STOREFRONT_REPOSITORY)
    private readonly storefronts: StorefrontRepository,
    @Inject(MENU_REPOSITORY)
    private readonly menus: MenuRepository,
  ) {}

  async get(storeId: string): Promise<AdminStorefrontResult> {
    const store = await this.store(storeId);
    const storefront = await this.owned.storefrontOf(storeId);
    const [categories, items] = await Promise.all([
      this.menus.findCategories(storeId),
      this.menus.findItems(storeId),
    ]);
    return {
      ...myStorefrontResult(
        store,
        storefront,
        items.filter((item) => item.visible).length,
        new Date(),
      ),
      hiddenAt: storefront.snapshot().hiddenAt,
      menu: menuResult(categories, items, { visibleOnly: false }),
    };
  }

  /** 손님 앱에서 내리거나(사유 필수) 다시 올린다. */
  async setHidden(
    storeId: string,
    hidden: boolean,
    reason: string | null,
  ): Promise<AdminStorefrontResult> {
    await this.store(storeId);
    const storefront = await this.owned.storefrontOf(storeId);
    storefront.setHidden(hidden, reason, new Date());
    await this.storefronts.save(storefront);
    return this.get(storeId);
  }

  private async store(storeId: string): Promise<Store> {
    const store = await this.stores.findById(storeId);
    if (!store) {
      throw new NotFoundError('STORE_NOT_FOUND', '가게를 찾을 수 없어요.');
    }
    return store;
  }
}
