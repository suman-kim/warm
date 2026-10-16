import { Inject, Injectable } from '@nestjs/common';
import {
  FILE_STORAGE,
  type FileStorage,
} from '../../../../common/application/file-storage.port.js';
import { ConflictError } from '../../../../common/domain/domain-error.js';
import { StorefrontSettings } from '../../domain/entities/storefront.entity.js';
import {
  MENU_REPOSITORY,
  type MenuRepository,
  STOREFRONT_REPOSITORY,
  type StorefrontRepository,
} from '../../domain/repositories/marketplace.repositories.js';
import { MyStorefrontResult } from '../dto/marketplace.result.js';
import { newImage } from '../services/marketplace-images.js';
import { OwnedStore } from '../services/owned-store.js';
import { myStorefrontResult } from '../services/storefront-views.js';

/** 사장님의 주문앱 가게 운영 설정: 영업시간·휴무·임시 휴업, 최소주문·배달팁·배달 거리, 대표 사진. */
@Injectable()
export class MyStorefrontUseCase {
  constructor(
    private readonly owned: OwnedStore,
    @Inject(STOREFRONT_REPOSITORY)
    private readonly storefronts: StorefrontRepository,
    @Inject(MENU_REPOSITORY)
    private readonly menus: MenuRepository,
    @Inject(FILE_STORAGE)
    private readonly files: FileStorage,
  ) {}

  async get(ownerUserId: string): Promise<MyStorefrontResult> {
    const { store, storefront } = await this.owned.storefront(ownerUserId);
    return myStorefrontResult(
      store,
      storefront,
      await this.menus.countItems(store.id, { visibleOnly: true }),
      new Date(),
    );
  }

  async updateSettings(
    ownerUserId: string,
    settings: StorefrontSettings,
  ): Promise<MyStorefrontResult> {
    const { storefront } = await this.owned.storefront(ownerUserId);
    storefront.updateSettings(settings, new Date());
    await this.storefronts.save(storefront);
    return this.get(ownerUserId);
  }

  async uploadLogo(
    ownerUserId: string,
    bytes: Buffer,
  ): Promise<MyStorefrontResult> {
    const { store, storefront } = await this.owned.storefront(ownerUserId);
    const image = newImage(store.id, bytes);
    const previous = storefront.logoKey;
    await this.files.save(image.key, bytes, image.contentType);
    storefront.setLogo(image.key, new Date());
    await this.storefronts.save(storefront);
    if (previous) await this.files.delete(previous);
    return this.get(ownerUserId);
  }

  /** 주문 받기 켜기·끄기. 켜려면 가게 승인이 끝났고 손님에게 보이는 메뉴가 있어야 한다. */
  async setOpen(
    ownerUserId: string,
    open: boolean,
  ): Promise<MyStorefrontResult> {
    const { store, storefront } = await this.owned.storefront(ownerUserId);
    if (open) {
      if (!store.isApproved) {
        throw new ConflictError(
          'STORE_NOT_APPROVED',
          '가게 승인이 끝나면 주문을 받을 수 있어요.',
        );
      }
      if (
        (await this.menus.countItems(store.id, { visibleOnly: true })) === 0
      ) {
        throw new ConflictError(
          'NO_VISIBLE_MENU',
          '손님에게 보이는 메뉴를 하나 이상 등록해 주세요.',
        );
      }
    }
    storefront.setOpen(open, new Date());
    await this.storefronts.save(storefront);
    return this.get(ownerUserId);
  }

  /** 임시 휴업. minutes가 null이면 휴업을 끝낸다. */
  async pause(
    ownerUserId: string,
    minutes: number | null,
  ): Promise<MyStorefrontResult> {
    const { storefront } = await this.owned.storefront(ownerUserId);
    storefront.pause(minutes, new Date());
    await this.storefronts.save(storefront);
    return this.get(ownerUserId);
  }
}
