import { AggregateRoot } from '../../../../common/domain/aggregate-root.js';
import { InvalidArgumentError } from '../../../../common/domain/domain-error.js';

/** 메뉴 카테고리 (가게 안의 묶음: 대표 메뉴, 사이드 등). */
export interface MenuCategory {
  id: string;
  storeId: string;
  name: string;
  sortOrder: number;
  createdAt: Date;
}

export interface MenuOption {
  id: string;
  name: string;
  /** 더해지는 금액 (원) */
  price: number;
  soldOut: boolean;
}

/** 옵션 묶음. [minSelect]가 1 이상이면 꼭 골라야 한다. */
export interface MenuOptionGroup {
  id: string;
  name: string;
  minSelect: number;
  maxSelect: number;
  options: MenuOption[];
}

/** 메뉴를 만들거나 고칠 때 받는 값. 옵션 ID가 없으면 새로 만든다. */
export interface MenuItemDetails {
  categoryId: string;
  name: string;
  description: string | null;
  price: number;
  sortOrder: number;
  hidden: boolean;
  optionGroups: (Omit<MenuOptionGroup, 'id' | 'options'> & {
    id?: string;
    options: (Omit<MenuOption, 'id' | 'soldOut'> & {
      id?: string;
      soldOut?: boolean;
    })[];
  })[];
}

export interface MenuItemState extends Omit<MenuItemDetails, 'optionGroups'> {
  id: string;
  storeId: string;
  optionGroups: MenuOptionGroup[];
  photoKey: string | null;
  soldOut: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/** 가게 하나의 메뉴 한도. */
export const MAX_MENU_CATEGORIES = 30;
export const MAX_MENU_ITEMS = 300;

/** 메뉴 하나. 품절과 숨김은 따로다 — 품절은 보이지만 담을 수 없고, 숨김은 손님에게 보이지 않는다. */
export class MenuItem extends AggregateRoot {
  private constructor(
    private readonly state: MenuItemState,
    version: number,
  ) {
    super(state.id, version);
  }

  static create(input: {
    id: string;
    storeId: string;
    details: MenuItemDetails;
    newId: () => string;
    now: Date;
  }): MenuItem {
    return new MenuItem(
      {
        id: input.id,
        storeId: input.storeId,
        ...normalizeDetails(input.details, input.newId),
        photoKey: null,
        soldOut: false,
        createdAt: input.now,
        updatedAt: input.now,
      },
      0,
    );
  }

  static restore(state: MenuItemState, version: number): MenuItem {
    return new MenuItem(structuredClone(state), version);
  }

  get storeId(): string {
    return this.state.storeId;
  }

  get categoryId(): string {
    return this.state.categoryId;
  }

  get photoKey(): string | null {
    return this.state.photoKey;
  }

  /** 손님이 지금 담을 수 있는지 */
  get orderable(): boolean {
    return !this.state.hidden && !this.state.soldOut;
  }

  get visible(): boolean {
    return !this.state.hidden;
  }

  snapshot(): MenuItemState {
    return structuredClone(this.state);
  }

  update(details: MenuItemDetails, newId: () => string, now: Date): void {
    Object.assign(this.state, normalizeDetails(details, newId));
    this.state.updatedAt = now;
  }

  setSoldOut(soldOut: boolean, now: Date): void {
    this.state.soldOut = soldOut;
    this.state.updatedAt = now;
  }

  setPhoto(key: string, now: Date): void {
    this.state.photoKey = key;
    this.state.updatedAt = now;
  }
}

/** 카테고리 이름을 확인한다. */
export function menuCategoryName(raw: string): string {
  const name = raw.trim();
  if (!name || name.length > 30) {
    throw new InvalidArgumentError(
      'INVALID_MENU_CATEGORY',
      '카테고리 이름은 1~30자로 적어 주세요.',
    );
  }
  return name;
}

function normalizeDetails(
  details: MenuItemDetails,
  newId: () => string,
): Omit<
  MenuItemState,
  'id' | 'storeId' | 'photoKey' | 'soldOut' | 'createdAt' | 'updatedAt'
> {
  const name = details.name.trim();
  if (!name || name.length > 50) {
    throw invalid('INVALID_MENU_NAME', '메뉴 이름은 1~50자로 적어 주세요.');
  }
  const description = details.description?.trim() || null;
  if (description && description.length > 300) {
    throw invalid(
      'INVALID_MENU_DESCRIPTION',
      '메뉴 설명은 300자까지 쓸 수 있어요.',
    );
  }
  if (!won(details.price, 1_000_000)) {
    throw invalid(
      'INVALID_MENU_PRICE',
      '가격은 0원부터 100만 원까지 적어 주세요.',
    );
  }
  if (!Number.isInteger(details.sortOrder) || details.sortOrder < 0) {
    throw invalid('INVALID_SORT_ORDER', '순서가 올바르지 않아요.');
  }
  if (details.optionGroups.length > 10) {
    throw invalid(
      'TOO_MANY_OPTION_GROUPS',
      '옵션 묶음은 10개까지 만들 수 있어요.',
    );
  }
  const ids = new Set<string>();
  const unique = (id: string | undefined): string => {
    const value = id?.trim() || newId();
    if (ids.has(value)) {
      throw invalid('DUPLICATE_OPTION_ID', '옵션 ID가 겹쳐요.');
    }
    ids.add(value);
    return value;
  };
  const optionGroups = details.optionGroups.map((group) => {
    const groupName = group.name.trim();
    if (!groupName || groupName.length > 30) {
      throw invalid(
        'INVALID_OPTION_GROUP',
        '옵션 묶음 이름은 1~30자로 적어 주세요.',
      );
    }
    if (group.options.length < 1 || group.options.length > 30) {
      throw invalid(
        'INVALID_OPTION_GROUP',
        '옵션 묶음에는 옵션이 1~30개 있어야 해요.',
      );
    }
    if (
      !Number.isInteger(group.minSelect) ||
      !Number.isInteger(group.maxSelect) ||
      group.minSelect < 0 ||
      group.maxSelect < 1 ||
      group.minSelect > group.maxSelect ||
      group.maxSelect > group.options.length
    ) {
      throw invalid(
        'INVALID_OPTION_SELECT_RANGE',
        `'${groupName}'의 고를 수 있는 개수를 확인해 주세요.`,
      );
    }
    return {
      id: unique(group.id),
      name: groupName,
      minSelect: group.minSelect,
      maxSelect: group.maxSelect,
      options: group.options.map((option) => {
        const optionName = option.name.trim();
        if (!optionName || optionName.length > 30) {
          throw invalid('INVALID_OPTION', '옵션 이름은 1~30자로 적어 주세요.');
        }
        if (!won(option.price, 100_000)) {
          throw invalid(
            'INVALID_OPTION_PRICE',
            '옵션 금액은 0원부터 10만 원까지예요.',
          );
        }
        return {
          id: unique(option.id),
          name: optionName,
          price: option.price,
          soldOut: option.soldOut ?? false,
        };
      }),
    };
  });
  return {
    categoryId: details.categoryId,
    name,
    description,
    price: details.price,
    sortOrder: details.sortOrder,
    hidden: details.hidden,
    optionGroups,
  };
}

function won(value: number, max: number): boolean {
  return Number.isInteger(value) && value >= 0 && value <= max;
}

function invalid(code: string, message: string): InvalidArgumentError {
  return new InvalidArgumentError(code, message);
}
