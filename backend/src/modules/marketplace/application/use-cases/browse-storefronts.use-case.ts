import { Inject, Injectable } from '@nestjs/common';
import {
  FILE_STORAGE,
  type FileStorage,
} from '../../../../common/application/file-storage.port.js';
import {
  PageQuery,
  toPageRequest,
} from '../../../../common/application/page.js';
import { NotFoundError } from '../../../../common/domain/domain-error.js';
import {
  STORE_REPOSITORY,
  type StoreRepository,
} from '../../../store/domain/store.repository.js';
import { Storefront } from '../../domain/entities/storefront.entity.js';
import {
  FOOD_ORDER_REPOSITORY,
  type FoodOrderRepository,
  MENU_REPOSITORY,
  type MenuRepository,
  REVIEW_REPOSITORY,
  type ReviewRepository,
  STOREFRONT_REPOSITORY,
  type StorefrontRepository,
} from '../../domain/repositories/marketplace.repositories.js';
import { straightDistanceKm } from '../../domain/services/cart-pricing.js';
import {
  Page,
  ReviewResult,
  StorefrontCardResult,
  StorefrontDetailResult,
} from '../dto/marketplace.result.js';
import {
  STOREFRONT_QUERY,
  type StorefrontQuery,
} from '../ports/storefront.query.js';
import {
  contentTypeOf,
  imageKey,
  imageUrl,
} from '../services/marketplace-images.js';
import { estimatedMinutes, menuResult } from '../services/storefront-views.js';

/** 가게 목록 정렬. 어느 정렬이든 지금 주문받는 가게가 먼저다. */
export enum StorefrontSort {
  DISTANCE = 'DISTANCE',
  /** 배달팁 적은 순 */
  DELIVERY_TIP = 'DELIVERY_TIP',
  /** 최근 30일 주문 많은 순 */
  POPULAR = 'POPULAR',
  /** 별점 높은 순 */
  RATING = 'RATING',
}

export interface BrowseStorefrontsFilter {
  latitude: number;
  longitude: number;
  category?: string;
  q?: string;
  sort: StorefrontSort;
  /** 지금 주문받는 가게만 */
  openOnly?: boolean;
  /** 최소 주문 금액이 이 이하인 가게만 */
  maxMinOrder?: number;
}

const POPULAR_DAYS = 30;
/** 배달팁 범위를 구할 때 쓰는 아주 큰 주문 금액 */
const LARGE_ORDER = 10_000_000;

/** 손님 앱의 가게 찾기·가게 상세·리뷰·사진. 로그인 없이 볼 수 있다. */
@Injectable()
export class BrowseStorefrontsUseCase {
  constructor(
    @Inject(STOREFRONT_QUERY)
    private readonly query: StorefrontQuery,
    @Inject(STOREFRONT_REPOSITORY)
    private readonly storefronts: StorefrontRepository,
    @Inject(STORE_REPOSITORY)
    private readonly stores: StoreRepository,
    @Inject(MENU_REPOSITORY)
    private readonly menus: MenuRepository,
    @Inject(REVIEW_REPOSITORY)
    private readonly reviewRepository: ReviewRepository,
    @Inject(FOOD_ORDER_REPOSITORY)
    private readonly orders: FoodOrderRepository,
    @Inject(FILE_STORAGE)
    private readonly files: FileStorage,
  ) {}

  async list(
    filter: BrowseStorefrontsFilter,
    page: PageQuery,
  ): Promise<Page<StorefrontCardResult>> {
    const now = new Date();
    const rows = await this.query.nearby(filter);
    const storeIds = rows.map((row) => row.storefront.storeId);
    const ratings = await this.reviewRepository.summaries(storeIds);
    const popularity =
      filter.sort === StorefrontSort.POPULAR
        ? await this.orders.deliveredCounts(
            storeIds,
            new Date(now.getTime() - POPULAR_DAYS * 24 * 60 * 60_000),
          )
        : new Map<string, number>();
    const cards = rows
      .map((row) => {
        const state = row.storefront.snapshot();
        const rating = ratings.get(state.storeId);
        const card: StorefrontCardResult = {
          storeId: state.storeId,
          name: row.storeName,
          category: state.category,
          logoUrl: imageUrl(state.logoKey),
          distanceKm: row.distanceKm,
          minOrderAmount: state.minOrderAmount,
          deliveryTipMin: row.storefront.deliveryTipFor(
            LARGE_ORDER,
            row.distanceKm,
          ),
          deliveryTipMax: row.storefront.deliveryTipFor(
            state.minOrderAmount,
            row.distanceKm,
          ),
          estimatedMinutes: estimatedMinutes(row.distanceKm),
          rating: rating?.average ?? null,
          reviewCount: rating?.count ?? 0,
          closedReason: row.storefront.availability(now),
        };
        return card;
      })
      .filter(
        (card) =>
          (!filter.openOnly || card.closedReason === null) &&
          (filter.maxMinOrder === undefined ||
            card.minOrderAmount <= filter.maxMinOrder),
      );
    const key = (card: StorefrontCardResult): number => {
      switch (filter.sort) {
        case StorefrontSort.DELIVERY_TIP:
          return card.deliveryTipMax;
        case StorefrontSort.POPULAR:
          return -(popularity.get(card.storeId) ?? 0);
        case StorefrontSort.RATING:
          return -(card.rating ?? 0);
        default:
          return card.distanceKm;
      }
    };
    cards.sort(
      (a, b) =>
        Number(a.closedReason !== null) - Number(b.closedReason !== null) ||
        key(a) - key(b) ||
        a.distanceKm - b.distanceKm,
    );
    const { offset, limit } = toPageRequest(page);
    return {
      items: cards.slice(offset, offset + limit),
      total: cards.length,
      page: page.page,
      size: page.size,
    };
  }

  /** 가게 상세와 메뉴. 손님 주소를 함께 주면 그 주소의 배달 가능 여부와 배달팁을 붙인다. */
  async detail(
    storeId: string,
    at: { latitude: number; longitude: number } | null,
  ): Promise<StorefrontDetailResult> {
    const { storefront, store } = await this.visible(storeId);
    const now = new Date();
    const state = storefront.snapshot();
    const storeState = store.snapshot();
    const rating = (await this.reviewRepository.summaries([storeId])).get(
      storeId,
    );
    const distanceKm = at ? straightDistanceKm(storeState.address, at) : null;
    return {
      storeId,
      name: storeState.name,
      phone: storeState.phone,
      address: [storeState.address.address, storeState.address.detailAddress]
        .filter(Boolean)
        .join(' '),
      category: state.category,
      description: state.description,
      originNotice: state.originNotice,
      logoUrl: imageUrl(state.logoKey),
      minOrderAmount: state.minOrderAmount,
      maxDeliveryKm: state.maxDeliveryKm,
      deliveryTipRules: state.deliveryTipRules,
      distanceTipRules: state.distanceTipRules,
      businessHours: state.businessHours,
      holidays: state.holidays,
      closedReason: storefront.availability(now),
      pausedUntil:
        state.pausedUntil && state.pausedUntil > now ? state.pausedUntil : null,
      rating: rating?.average ?? null,
      reviewCount: rating?.count ?? 0,
      delivery:
        distanceKm === null
          ? null
          : {
              distanceKm,
              deliverable: distanceKm <= state.maxDeliveryKm,
              deliveryTip: storefront.deliveryTipFor(
                state.minOrderAmount,
                distanceKm,
              ),
              estimatedMinutes: estimatedMinutes(distanceKm),
            },
      menu: menuResult(
        await this.menus.findCategories(storeId),
        await this.menus.findItems(storeId),
        { visibleOnly: true },
      ),
    };
  }

  async reviews(storeId: string, page: PageQuery): Promise<Page<ReviewResult>> {
    await this.visible(storeId);
    const result = await this.reviewRepository.findByStore(
      storeId,
      toPageRequest(page),
    );
    return {
      items: result.items.map((review) => ({
        id: review.id,
        foodOrderId: review.foodOrderId,
        authorName: review.authorName,
        rating: review.rating,
        content: review.content,
        orderSummary: review.orderSummary,
        createdAt: review.createdAt,
      })),
      total: result.total,
      page: page.page,
      size: page.size,
    };
  }

  /** 가게 대표 사진·메뉴 사진 */
  async image(
    storeId: string,
    file: string,
  ): Promise<{ bytes: Buffer; contentType: string }> {
    const key = imageKey(storeId, file);
    const bytes = key ? await this.files.read(key) : null;
    if (!bytes) {
      throw new NotFoundError('IMAGE_NOT_FOUND', '사진을 찾을 수 없어요.');
    }
    return { bytes, contentType: contentTypeOf(file) };
  }

  /** 손님에게 보이는 가게: 승인됐고 운영자가 내리지 않았다. */
  private async visible(storeId: string) {
    const [store, storefront] = await Promise.all([
      this.stores.findById(storeId),
      this.storefronts.findByStoreId(storeId),
    ]);
    if (!store || !store.isApproved || !storefront || isHidden(storefront)) {
      throw new NotFoundError('STOREFRONT_NOT_FOUND', '가게를 찾을 수 없어요.');
    }
    return { store, storefront };
  }
}

function isHidden(storefront: Storefront): boolean {
  return storefront.snapshot().hiddenAt !== null;
}
