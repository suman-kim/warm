import { Column, Entity, Index, PrimaryColumn } from 'typeorm';
import type { MenuOptionGroup } from '../../domain/entities/menu.entity.js';

@Entity({ name: 'menu_categories', comment: '메뉴 카테고리 (가게 안의 묶음)' })
@Index('idx_menu_categories_store', ['storeId', 'sortOrder'])
export class MenuCategoryOrmEntity {
  @PrimaryColumn('uuid', { comment: '카테고리 ID' })
  id: string;

  @Column('uuid', { name: 'store_id', comment: '가게 (stores.id)' })
  storeId: string;

  @Column('varchar', { length: 30, comment: '카테고리 이름' })
  name: string;

  @Column('int', { name: 'sort_order', comment: '보이는 순서 (작을수록 위)' })
  sortOrder: number;

  @Column('timestamptz', { name: 'created_at', comment: '만든 시각' })
  createdAt: Date;
}

@Entity({ name: 'menu_items', comment: '메뉴 (옵션 묶음 포함)' })
@Index('idx_menu_items_store', ['storeId', 'sortOrder'])
@Index('idx_menu_items_category', ['categoryId'])
export class MenuItemOrmEntity {
  @PrimaryColumn('uuid', { comment: '메뉴 ID' })
  id: string;

  @Column('uuid', { name: 'store_id', comment: '가게 (stores.id)' })
  storeId: string;

  @Column('uuid', {
    name: 'category_id',
    comment: '카테고리 (menu_categories.id)',
  })
  categoryId: string;

  @Column('varchar', { length: 50, comment: '메뉴 이름' })
  name: string;

  @Column('varchar', { length: 300, nullable: true, comment: '메뉴 설명' })
  description: string | null;

  @Column('int', { comment: '가격(원)' })
  price: number;

  @Column('int', { name: 'sort_order', comment: '카테고리 안에서 보이는 순서' })
  sortOrder: number;

  @Column('boolean', { comment: '손님에게 숨겼는지' })
  hidden: boolean;

  @Column('boolean', {
    name: 'sold_out',
    comment: '품절 (보이지만 담을 수 없다)',
  })
  soldOut: boolean;

  @Column('varchar', {
    name: 'photo_key',
    length: 200,
    nullable: true,
    comment: '메뉴 사진 (파일 보관소 키)',
  })
  photoKey: string | null;

  @Column('jsonb', {
    name: 'option_groups',
    comment:
      '옵션 묶음 [{id, name, minSelect, maxSelect, options: [{id, name, price, soldOut}]}]',
  })
  optionGroups: MenuOptionGroup[];

  @Column('int', { comment: '낙관적 잠금 버전' })
  version: number;

  @Column('timestamptz', { name: 'created_at', comment: '만든 시각' })
  createdAt: Date;

  @Column('timestamptz', {
    name: 'updated_at',
    comment: '마지막으로 바뀐 시각',
  })
  updatedAt: Date;
}
