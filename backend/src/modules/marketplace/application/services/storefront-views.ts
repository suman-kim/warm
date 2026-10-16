import { Store } from '../../../store/domain/store.entity.js';
import { MenuCategory, MenuItem } from '../../domain/entities/menu.entity.js';
import { Storefront } from '../../domain/entities/storefront.entity.js';
import {
  MenuCategoryResult,
  MenuItemResult,
  MyStorefrontResult,
} from '../dto/marketplace.result.js';
import { imageUrl } from './marketplace-images.js';

export function myStorefrontResult(
  store: Store,
  storefront: Storefront,
  visibleMenuCount: number,
  now: Date,
): MyStorefrontResult {
  const state = storefront.snapshot();
  return {
    storeId: state.storeId,
    storeName: store.snapshot().name,
    approved: store.isApproved,
    settings: {
      category: state.category,
      description: state.description,
      originNotice: state.originNotice,
      minOrderAmount: state.minOrderAmount,
      maxDeliveryKm: state.maxDeliveryKm,
      deliveryTipRules: state.deliveryTipRules,
      distanceTipRules: state.distanceTipRules,
      businessHours: state.businessHours,
      holidays: state.holidays,
    },
    logoUrl: imageUrl(state.logoKey),
    open: state.open,
    pausedUntil:
      state.pausedUntil && state.pausedUntil > now ? state.pausedUntil : null,
    hidden: state.hiddenAt !== null,
    hiddenReason: state.hiddenReason,
    closedReason: storefront.availability(now),
    visibleMenuCount,
  };
}

export function menuItemResult(item: MenuItem): MenuItemResult {
  const state = item.snapshot();
  return {
    id: state.id,
    categoryId: state.categoryId,
    name: state.name,
    description: state.description,
    price: state.price,
    sortOrder: state.sortOrder,
    hidden: state.hidden,
    soldOut: state.soldOut,
    photoUrl: imageUrl(state.photoKey),
    optionGroups: state.optionGroups,
  };
}

/** 카테고리 순서대로 메뉴를 묶는다. 손님에게는 숨긴 메뉴와 빈 카테고리를 빼고 준다. */
export function menuResult(
  categories: MenuCategory[],
  items: MenuItem[],
  options: { visibleOnly: boolean },
): MenuCategoryResult[] {
  return categories
    .map((category) => ({
      id: category.id,
      name: category.name,
      sortOrder: category.sortOrder,
      items: items
        .filter(
          (item) =>
            item.categoryId === category.id &&
            (!options.visibleOnly || item.visible),
        )
        .map(menuItemResult),
    }))
    .filter((category) => !options.visibleOnly || category.items.length > 0);
}

/**
 * 예상 도착 시간(분) 어림: 조리 20분 + 픽업 5분 + 이동(직선 거리의 1.3배를 시속 20km로).
 * 5분 단위로 올리고 10분 폭으로 보여 준다.
 */
export function estimatedMinutes(distanceKm: number): {
  min: number;
  max: number;
} {
  const travel = ((distanceKm * 1.3) / 20) * 60;
  const min = Math.ceil((25 + travel) / 5) * 5;
  return { min, max: min + 10 };
}
