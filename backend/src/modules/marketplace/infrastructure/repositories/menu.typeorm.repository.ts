import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { persistAggregate } from '../../../../common/infrastructure/persistence/persist-aggregate.js';
import { MenuCategory, MenuItem } from '../../domain/entities/menu.entity.js';
import { MenuRepository } from '../../domain/repositories/marketplace.repositories.js';
import {
  MenuCategoryOrmEntity,
  MenuItemOrmEntity,
} from '../entities/menu.orm-entity.js';

@Injectable()
export class MenuTypeormRepository implements MenuRepository {
  constructor(
    @InjectRepository(MenuCategoryOrmEntity)
    private readonly categories: Repository<MenuCategoryOrmEntity>,
    @InjectRepository(MenuItemOrmEntity)
    private readonly items: Repository<MenuItemOrmEntity>,
  ) {}

  async findCategories(storeId: string): Promise<MenuCategory[]> {
    const rows = await this.categories.find({
      where: { storeId },
      order: { sortOrder: 'ASC', createdAt: 'ASC' },
    });
    return rows.map((row) => ({ ...row }));
  }

  async findCategory(id: string): Promise<MenuCategory | null> {
    const row = await this.categories.findOne({ where: { id } });
    return row ? { ...row } : null;
  }

  async saveCategory(category: MenuCategory): Promise<void> {
    await this.categories.save(
      Object.assign(new MenuCategoryOrmEntity(), category),
    );
  }

  async deleteCategory(id: string): Promise<void> {
    await this.categories.delete({ id });
  }

  async findItems(storeId: string): Promise<MenuItem[]> {
    const rows = await this.items
      .createQueryBuilder('i')
      .leftJoin(MenuCategoryOrmEntity, 'c', 'c.id = i.category_id')
      .where('i.store_id = :storeId', { storeId })
      .orderBy('c.sort_order', 'ASC')
      .addOrderBy('i.sort_order', 'ASC')
      .addOrderBy('i.created_at', 'ASC')
      .getMany();
    return rows.map(toMenuItem);
  }

  async findItem(id: string): Promise<MenuItem | null> {
    const row = await this.items.findOne({ where: { id } });
    return row ? toMenuItem(row) : null;
  }

  saveItem(item: MenuItem): Promise<void> {
    const state = item.snapshot();
    return persistAggregate(this.items, item, {
      id: state.id,
      storeId: state.storeId,
      categoryId: state.categoryId,
      name: state.name,
      description: state.description,
      price: state.price,
      sortOrder: state.sortOrder,
      hidden: state.hidden,
      soldOut: state.soldOut,
      photoKey: state.photoKey,
      optionGroups: state.optionGroups,
      version: item.version,
      createdAt: state.createdAt,
      updatedAt: state.updatedAt,
    });
  }

  async deleteItem(id: string): Promise<void> {
    await this.items.delete({ id });
  }

  countItems(
    storeId: string,
    filter: { categoryId?: string; visibleOnly?: boolean } = {},
  ): Promise<number> {
    return this.items.count({
      where: {
        storeId,
        ...(filter.categoryId ? { categoryId: filter.categoryId } : {}),
        ...(filter.visibleOnly ? { hidden: false } : {}),
      },
    });
  }
}

function toMenuItem(row: MenuItemOrmEntity): MenuItem {
  return MenuItem.restore(
    {
      id: row.id,
      storeId: row.storeId,
      categoryId: row.categoryId,
      name: row.name,
      description: row.description,
      price: row.price,
      sortOrder: row.sortOrder,
      hidden: row.hidden,
      soldOut: row.soldOut,
      photoKey: row.photoKey,
      optionGroups: row.optionGroups,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    },
    row.version,
  );
}
