import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import {
  FILE_STORAGE,
  type FileStorage,
} from '../../../../common/application/file-storage.port.js';
import {
  ConflictError,
  InvalidArgumentError,
  NotFoundError,
} from '../../../../common/domain/domain-error.js';
import {
  MAX_MENU_CATEGORIES,
  MAX_MENU_ITEMS,
  MenuCategory,
  menuCategoryName,
  MenuItem,
  MenuItemDetails,
} from '../../domain/entities/menu.entity.js';
import {
  MENU_REPOSITORY,
  type MenuRepository,
} from '../../domain/repositories/marketplace.repositories.js';
import {
  MenuCategoryResult,
  MenuItemResult,
} from '../dto/marketplace.result.js';
import { newImage } from '../services/marketplace-images.js';
import { OwnedStore } from '../services/owned-store.js';
import { menuItemResult, menuResult } from '../services/storefront-views.js';

/** 사장님의 메뉴 관리: 카테고리, 메뉴·옵션, 품절, 사진. */
@Injectable()
export class MyMenuUseCase {
  constructor(
    private readonly owned: OwnedStore,
    @Inject(MENU_REPOSITORY)
    private readonly menus: MenuRepository,
    @Inject(FILE_STORAGE)
    private readonly files: FileStorage,
  ) {}

  /** 숨긴 메뉴와 빈 카테고리까지 모두 */
  async get(ownerUserId: string): Promise<MenuCategoryResult[]> {
    const store = await this.owned.store(ownerUserId);
    return menuResult(
      await this.menus.findCategories(store.id),
      await this.menus.findItems(store.id),
      { visibleOnly: false },
    );
  }

  async createCategory(
    ownerUserId: string,
    name: string,
  ): Promise<MenuCategoryResult[]> {
    const store = await this.owned.store(ownerUserId);
    const categories = await this.menus.findCategories(store.id);
    if (categories.length >= MAX_MENU_CATEGORIES) {
      throw new ConflictError(
        'TOO_MANY_MENU_CATEGORIES',
        `카테고리는 ${MAX_MENU_CATEGORIES}개까지 만들 수 있어요.`,
      );
    }
    await this.menus.saveCategory({
      id: randomUUID(),
      storeId: store.id,
      name: menuCategoryName(name),
      sortOrder: categories.length,
      createdAt: new Date(),
    });
    return this.get(ownerUserId);
  }

  async updateCategory(
    ownerUserId: string,
    categoryId: string,
    changes: { name: string; sortOrder: number },
  ): Promise<MenuCategoryResult[]> {
    const category = await this.category(ownerUserId, categoryId);
    if (!Number.isInteger(changes.sortOrder) || changes.sortOrder < 0) {
      throw new InvalidArgumentError(
        'INVALID_SORT_ORDER',
        '순서가 올바르지 않아요.',
      );
    }
    await this.menus.saveCategory({
      ...category,
      name: menuCategoryName(changes.name),
      sortOrder: changes.sortOrder,
    });
    return this.get(ownerUserId);
  }

  /** 메뉴가 남은 카테고리는 지울 수 없다. */
  async deleteCategory(
    ownerUserId: string,
    categoryId: string,
  ): Promise<MenuCategoryResult[]> {
    const category = await this.category(ownerUserId, categoryId);
    if ((await this.menus.countItems(category.storeId, { categoryId })) > 0) {
      throw new ConflictError(
        'MENU_CATEGORY_NOT_EMPTY',
        '카테고리 안의 메뉴를 먼저 옮기거나 지워 주세요.',
      );
    }
    await this.menus.deleteCategory(categoryId);
    return this.get(ownerUserId);
  }

  async createItem(
    ownerUserId: string,
    details: MenuItemDetails,
  ): Promise<MenuItemResult> {
    const store = await this.owned.store(ownerUserId);
    await this.category(ownerUserId, details.categoryId);
    if ((await this.menus.countItems(store.id)) >= MAX_MENU_ITEMS) {
      throw new ConflictError(
        'TOO_MANY_MENU_ITEMS',
        `메뉴는 ${MAX_MENU_ITEMS}개까지 등록할 수 있어요.`,
      );
    }
    const item = MenuItem.create({
      id: randomUUID(),
      storeId: store.id,
      details,
      newId: randomUUID,
      now: new Date(),
    });
    await this.menus.saveItem(item);
    return menuItemResult(item);
  }

  async updateItem(
    ownerUserId: string,
    itemId: string,
    details: MenuItemDetails,
  ): Promise<MenuItemResult> {
    const item = await this.item(ownerUserId, itemId);
    if (details.categoryId !== item.categoryId) {
      await this.category(ownerUserId, details.categoryId);
    }
    item.update(details, randomUUID, new Date());
    await this.menus.saveItem(item);
    return menuItemResult(item);
  }

  async deleteItem(ownerUserId: string, itemId: string): Promise<void> {
    const item = await this.item(ownerUserId, itemId);
    await this.menus.deleteItem(item.id);
    if (item.photoKey) await this.files.delete(item.photoKey);
  }

  async setSoldOut(
    ownerUserId: string,
    itemId: string,
    soldOut: boolean,
  ): Promise<MenuItemResult> {
    const item = await this.item(ownerUserId, itemId);
    item.setSoldOut(soldOut, new Date());
    await this.menus.saveItem(item);
    return menuItemResult(item);
  }

  async uploadPhoto(
    ownerUserId: string,
    itemId: string,
    bytes: Buffer,
  ): Promise<MenuItemResult> {
    const item = await this.item(ownerUserId, itemId);
    const image = newImage(item.storeId, bytes);
    const previous = item.photoKey;
    await this.files.save(image.key, bytes, image.contentType);
    item.setPhoto(image.key, new Date());
    await this.menus.saveItem(item);
    if (previous) await this.files.delete(previous);
    return menuItemResult(item);
  }

  private async category(
    ownerUserId: string,
    categoryId: string,
  ): Promise<MenuCategory> {
    const store = await this.owned.store(ownerUserId);
    const category = await this.menus.findCategory(categoryId);
    if (!category || category.storeId !== store.id) {
      throw new NotFoundError(
        'MENU_CATEGORY_NOT_FOUND',
        '카테고리를 찾을 수 없어요.',
      );
    }
    return category;
  }

  private async item(ownerUserId: string, itemId: string): Promise<MenuItem> {
    const store = await this.owned.store(ownerUserId);
    const item = await this.menus.findItem(itemId);
    if (!item || item.storeId !== store.id) {
      throw new NotFoundError('MENU_ITEM_NOT_FOUND', '메뉴를 찾을 수 없어요.');
    }
    return item;
  }
}
