import {
  ConflictError,
  InvalidArgumentError,
} from '../../../../common/domain/domain-error.js';
import { MenuItem } from '../entities/menu.entity.js';

/** 장바구니 한 줄 (손님이 보낸 것). */
export interface CartLineInput {
  menuItemId: string;
  quantity: number;
  options?: { groupId: string; optionIds: string[] }[];
}

/** 주문에 남기는 한 줄. 메뉴가 바뀌어도 주문 당시의 이름과 가격을 지킨다. */
export interface FoodOrderLine {
  menuItemId: string;
  name: string;
  /** 메뉴 가격 + 고른 옵션 금액 */
  unitPrice: number;
  quantity: number;
  options: { groupName: string; name: string; price: number }[];
  lineTotal: number;
}

const MAX_LINES = 30;
const MAX_QUANTITY = 50;

/**
 * 장바구니의 금액을 서버가 다시 계산한다 — 손님 앱이 보낸 금액은 믿지 않는다.
 * 없거나 숨긴 메뉴, 품절, 옵션 개수가 맞지 않으면 거절한다.
 */
export function priceCart(
  items: ReadonlyMap<string, MenuItem>,
  lines: CartLineInput[],
): { lines: FoodOrderLine[]; menuAmount: number } {
  if (lines.length === 0) {
    throw new InvalidArgumentError('EMPTY_CART', '메뉴를 담아 주세요.');
  }
  if (lines.length > MAX_LINES) {
    throw new InvalidArgumentError(
      'TOO_MANY_CART_LINES',
      `한 번에 ${MAX_LINES}가지까지 주문할 수 있어요.`,
    );
  }
  const priced = lines.map((line) => priceLine(items, line));
  return {
    lines: priced,
    menuAmount: priced.reduce((sum, line) => sum + line.lineTotal, 0),
  };
}

function priceLine(
  items: ReadonlyMap<string, MenuItem>,
  line: CartLineInput,
): FoodOrderLine {
  const item = items.get(line.menuItemId);
  if (!item || !item.visible) {
    throw new ConflictError(
      'MENU_ITEM_NOT_FOUND',
      '담은 메뉴 중 지금은 없는 메뉴가 있어요. 장바구니를 확인해 주세요.',
    );
  }
  const menu = item.snapshot();
  if (menu.soldOut) {
    throw new ConflictError(
      'MENU_ITEM_SOLD_OUT',
      `'${menu.name}'이(가) 품절됐어요.`,
    );
  }
  if (
    !Number.isInteger(line.quantity) ||
    line.quantity < 1 ||
    line.quantity > MAX_QUANTITY
  ) {
    throw new InvalidArgumentError(
      'INVALID_QUANTITY',
      `수량은 1개부터 ${MAX_QUANTITY}개까지예요.`,
    );
  }
  const selections = new Map(
    (line.options ?? []).map((selection) => [
      selection.groupId,
      selection.optionIds,
    ]),
  );
  for (const groupId of selections.keys()) {
    if (!menu.optionGroups.some((group) => group.id === groupId)) {
      throw invalidOption(menu.name);
    }
  }
  const options: FoodOrderLine['options'] = [];
  for (const group of menu.optionGroups) {
    const chosen = selections.get(group.id) ?? [];
    if (
      new Set(chosen).size !== chosen.length ||
      chosen.length < group.minSelect ||
      chosen.length > group.maxSelect
    ) {
      throw new InvalidArgumentError(
        'INVALID_OPTION_SELECTION',
        `'${menu.name}'의 '${group.name}'은(는) ${group.minSelect === group.maxSelect ? `${group.minSelect}개` : `${group.minSelect}~${group.maxSelect}개`} 골라 주세요.`,
      );
    }
    for (const optionId of chosen) {
      const option = group.options.find((each) => each.id === optionId);
      if (!option) throw invalidOption(menu.name);
      if (option.soldOut) {
        throw new ConflictError(
          'OPTION_SOLD_OUT',
          `'${menu.name}'의 '${option.name}'이(가) 품절됐어요.`,
        );
      }
      options.push({
        groupName: group.name,
        name: option.name,
        price: option.price,
      });
    }
  }
  const unitPrice =
    menu.price + options.reduce((sum, option) => sum + option.price, 0);
  return {
    menuItemId: menu.id,
    name: menu.name,
    unitPrice,
    quantity: line.quantity,
    options,
    lineTotal: unitPrice * line.quantity,
  };
}

function invalidOption(menuName: string): InvalidArgumentError {
  return new InvalidArgumentError(
    'INVALID_OPTION_SELECTION',
    `'${menuName}'의 옵션을 다시 골라 주세요.`,
  );
}

/** 두 점 사이의 직선 거리(km, 소수 첫째 자리). 배달 가능 거리와 거리별 배달팁에 쓴다. */
export function straightDistanceKm(
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number },
): number {
  const rad = (degree: number) => (degree * Math.PI) / 180;
  const a =
    Math.sin(rad(to.latitude - from.latitude) / 2) ** 2 +
    Math.cos(rad(from.latitude)) *
      Math.cos(rad(to.latitude)) *
      Math.sin(rad(to.longitude - from.longitude) / 2) ** 2;
  const km = 6371 * 2 * Math.asin(Math.sqrt(a));
  return Math.round(km * 10) / 10;
}
