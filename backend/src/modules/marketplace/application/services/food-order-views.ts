import { Inject, Injectable } from '@nestjs/common';
import { LinkedDeliveryService } from '../../../order/application/services/linked-delivery.service.js';
import {
  STORE_REPOSITORY,
  type StoreRepository,
} from '../../../store/domain/store.repository.js';
import { FoodOrder } from '../../domain/entities/food-order.entity.js';
import {
  REVIEW_REPOSITORY,
  type ReviewRepository,
  STOREFRONT_REPOSITORY,
  type StorefrontRepository,
} from '../../domain/repositories/marketplace.repositories.js';
import {
  FoodOrderDetailResult,
  FoodOrderSummaryResult,
} from '../dto/marketplace.result.js';
import { imageUrl } from './marketplace-images.js';

/** 누가 보는 주문 화면인지. 가게·운영자만 정산 계산을 본다. */
export type FoodOrderAudience = 'CONSUMER' | 'STORE' | 'ADMIN';

/** 주문을 화면 값으로 바꾼다. 가게 사진·리뷰 여부·배달 상태를 붙인다. */
@Injectable()
export class FoodOrderViews {
  constructor(
    @Inject(STOREFRONT_REPOSITORY)
    private readonly storefronts: StorefrontRepository,
    @Inject(STORE_REPOSITORY)
    private readonly stores: StoreRepository,
    @Inject(REVIEW_REPOSITORY)
    private readonly reviews: ReviewRepository,
    private readonly deliveries: LinkedDeliveryService,
  ) {}

  async summaries(
    orders: FoodOrder[],
    audience: FoodOrderAudience,
  ): Promise<FoodOrderSummaryResult[]> {
    if (orders.length === 0) return [];
    const storefronts = await this.storefronts.findByStoreIds([
      ...new Set(orders.map((order) => order.storeId)),
    ]);
    const logos = new Map(
      storefronts.map((storefront) => [storefront.storeId, storefront.logoKey]),
    );
    const reviewed =
      audience === 'CONSUMER'
        ? await this.reviews.reviewedOrderIds(orders.map((order) => order.id))
        : null;
    return orders.map((order) => {
      const state = order.snapshot();
      return {
        id: state.id,
        code: order.code,
        status: state.status,
        storeId: state.storeId,
        storeName: state.storeName,
        storeLogoUrl: imageUrl(logos.get(state.storeId) ?? null),
        summary: order.summary(),
        itemCount: state.lines.reduce((sum, line) => sum + line.quantity, 0),
        paymentAmount: state.paymentAmount,
        createdAt: state.createdAt,
        paidAt: state.paidAt,
        deliveredAt: state.deliveredAt,
        reviewed: reviewed ? reviewed.has(state.id) : null,
      };
    });
  }

  async detail(
    order: FoodOrder,
    audience: FoodOrderAudience,
  ): Promise<FoodOrderDetailResult> {
    const [summary] = await this.summaries([order], audience);
    const state = order.snapshot();
    const store = await this.stores.findById(state.storeId);
    const delivery = state.deliveryOrderId
      ? await this.deliveries.find(state.deliveryOrderId)
      : null;
    return {
      ...summary,
      consumerUserId: state.consumerUserId,
      consumerPhone: state.consumerPhone,
      storePhone: store?.snapshot().phone ?? null,
      lines: state.lines,
      menuAmount: state.menuAmount,
      deliveryTip: state.deliveryTip,
      dropoff: state.dropoff,
      distanceKm: state.distanceKm,
      storeRequest: state.storeRequest,
      riderRequest: state.riderRequest,
      disposableCutlery: state.disposableCutlery,
      paymentId: state.paymentId,
      cookMinutes: state.cookMinutes,
      acceptedAt: state.acceptedAt,
      pickedUpAt: state.pickedUpAt,
      rejectedAt: state.rejectedAt,
      rejectReason: state.rejectReason,
      cancelledAt: state.cancelledAt,
      cancelReason: state.cancelReason,
      cancelledBy: state.cancelledBy,
      refunds: state.refunds.map((refund) => ({
        id: refund.id,
        amount: refund.amount,
        reason: refund.reason,
        borneBy: refund.borneBy,
        status: refund.status,
        refundedAt: refund.refundedAt,
      })),
      refundableAmount: order.refundableAmount,
      delivery: delivery
        ? {
            deliveryId: delivery.deliveryId,
            status: delivery.status,
            driverName: delivery.driverName,
            estimatedPickupAt: delivery.estimatedPickupAt,
            estimatedDeliveryAt: delivery.estimatedDeliveryAt,
            assignedAt: delivery.assignedAt,
            pickedUpAt: delivery.pickedUpAt,
            deliveredAt: delivery.deliveredAt,
          }
        : null,
      settlement:
        audience === 'CONSUMER'
          ? null
          : {
              commissionRatePercent: state.commissionRatePercent,
              paymentFeeRatePercent: state.paymentFeeRatePercent,
              commission: Math.round(
                (state.menuAmount * state.commissionRatePercent) / 100,
              ),
              paymentFee: Math.round(
                (state.paymentAmount * state.paymentFeeRatePercent) / 100,
              ),
            },
    };
  }
}
