import { MenuItem, MenuItemDetails } from '../entities/menu.entity.js';
import { priceCart, straightDistanceKm } from './cart-pricing.js';

let sequence = 0;
const newId = () => `id-${++sequence}`;

function chicken(overrides: Partial<MenuItemDetails> = {}): MenuItem {
  return MenuItem.create({
    id: 'chicken',
    storeId: 'store-1',
    newId,
    now: new Date(),
    details: {
      categoryId: 'cat-1',
      name: '후라이드 치킨',
      description: null,
      price: 18000,
      sortOrder: 0,
      hidden: false,
      optionGroups: [
        {
          id: 'part',
          name: '부위',
          minSelect: 1,
          maxSelect: 1,
          options: [
            { id: 'whole', name: '한 마리', price: 0 },
            { id: 'boneless', name: '순살', price: 2000 },
          ],
        },
        {
          id: 'sauce',
          name: '소스 추가',
          minSelect: 0,
          maxSelect: 2,
          options: [
            { id: 'yangnyeom', name: '양념 소스', price: 500 },
            { id: 'honey', name: '허니 소스', price: 500, soldOut: true },
            { id: 'mustard', name: '머스타드', price: 300 },
          ],
        },
      ],
      ...overrides,
    },
  });
}

const menu = (...items: MenuItem[]) =>
  new Map(items.map((item) => [item.id, item]));

describe('priceCart', () => {
  it('메뉴 가격에 고른 옵션을 더하고 수량을 곱한다', () => {
    const result = priceCart(menu(chicken()), [
      {
        menuItemId: 'chicken',
        quantity: 2,
        options: [
          { groupId: 'part', optionIds: ['boneless'] },
          { groupId: 'sauce', optionIds: ['yangnyeom', 'mustard'] },
        ],
      },
    ]);
    expect(result.lines[0]).toMatchObject({
      name: '후라이드 치킨',
      unitPrice: 20800,
      quantity: 2,
      lineTotal: 41600,
    });
    expect(result.lines[0].options.map((option) => option.name)).toEqual([
      '순살',
      '양념 소스',
      '머스타드',
    ]);
    expect(result.menuAmount).toBe(41600);
  });

  it('필수 옵션을 고르지 않거나 너무 많이 고르면 받지 않는다', () => {
    expect(() =>
      priceCart(menu(chicken()), [{ menuItemId: 'chicken', quantity: 1 }]),
    ).toThrow(expect.objectContaining({ code: 'INVALID_OPTION_SELECTION' }));
    expect(() =>
      priceCart(menu(chicken()), [
        {
          menuItemId: 'chicken',
          quantity: 1,
          options: [{ groupId: 'part', optionIds: ['whole', 'boneless'] }],
        },
      ]),
    ).toThrow(expect.objectContaining({ code: 'INVALID_OPTION_SELECTION' }));
  });

  it('품절·숨김·없는 메뉴와 품절 옵션은 담을 수 없다', () => {
    const soldOut = chicken();
    soldOut.setSoldOut(true, new Date());
    const line = {
      menuItemId: 'chicken',
      quantity: 1,
      options: [{ groupId: 'part', optionIds: ['whole'] }],
    };
    expect(() => priceCart(menu(soldOut), [line])).toThrow(
      expect.objectContaining({ code: 'MENU_ITEM_SOLD_OUT' }),
    );
    expect(() => priceCart(menu(chicken({ hidden: true })), [line])).toThrow(
      expect.objectContaining({ code: 'MENU_ITEM_NOT_FOUND' }),
    );
    expect(() => priceCart(menu(), [line])).toThrow(
      expect.objectContaining({ code: 'MENU_ITEM_NOT_FOUND' }),
    );
    expect(() =>
      priceCart(menu(chicken()), [
        {
          ...line,
          options: [
            ...line.options,
            { groupId: 'sauce', optionIds: ['honey'] },
          ],
        },
      ]),
    ).toThrow(expect.objectContaining({ code: 'OPTION_SOLD_OUT' }));
  });

  it('빈 장바구니와 잘못된 수량은 받지 않는다', () => {
    expect(() => priceCart(menu(chicken()), [])).toThrow(
      expect.objectContaining({ code: 'EMPTY_CART' }),
    );
    expect(() =>
      priceCart(menu(chicken()), [
        {
          menuItemId: 'chicken',
          quantity: 0,
          options: [{ groupId: 'part', optionIds: ['whole'] }],
        },
      ]),
    ).toThrow(expect.objectContaining({ code: 'INVALID_QUANTITY' }));
  });
});

describe('straightDistanceKm', () => {
  it('두 점의 직선 거리를 소수 첫째 자리까지 준다', () => {
    expect(
      straightDistanceKm(
        { latitude: 37.5, longitude: 127.0364 },
        { latitude: 37.4955, longitude: 127.0495 },
      ),
    ).toBe(1.3);
  });
});
