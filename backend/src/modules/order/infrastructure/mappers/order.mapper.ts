import { Order } from '../../domain/entities/order.entity.js';
import { OrderStatus } from '../../domain/order-status.js';
import { Money } from '../../domain/value-objects/money.js';
import {
  CollectedMethod,
  DeliverySource,
  DoorPayment,
} from '../../domain/value-objects/store-delivery.js';
import { Waypoint } from '../../domain/value-objects/waypoint.js';
import { OrderOrmEntity } from '../entities/order.orm-entity.js';

/** 배달 도메인 ↔ ORM 매퍼. */
export class OrderMapper {
  static toOrm(order: Order): OrderOrmEntity {
    const state = order.snapshot();
    const delivery = state.storeDelivery;
    const orm = new OrderOrmEntity();
    orm.id = state.id;
    orm.customerId = state.customerId;
    orm.driverId = state.driverId;
    orm.status = state.status;
    orm.storeId = delivery.storeId;
    orm.source = delivery.source;
    orm.sourceOrderId = delivery.sourceOrderId;
    orm.pickupAddress = state.pickup.address;
    orm.pickupDetailAddress = state.pickup.detailAddress;
    orm.pickupSigungu = state.pickup.sigungu;
    orm.pickupDong = state.pickup.dong;
    orm.pickupLatitude = state.pickup.point.latitude;
    orm.pickupLongitude = state.pickup.point.longitude;
    orm.pickupContactName = state.pickup.contactName;
    orm.pickupContactPhone = state.pickup.contactPhone.value;
    orm.dropoffAddress = state.dropoff.address;
    orm.dropoffDetailAddress = state.dropoff.detailAddress;
    orm.dropoffSigungu = state.dropoff.sigungu;
    orm.dropoffDong = state.dropoff.dong;
    orm.dropoffLatitude = state.dropoff.point.latitude;
    orm.dropoffLongitude = state.dropoff.point.longitude;
    orm.dropoffContactName = state.dropoff.contactName;
    orm.dropoffContactPhone = state.dropoff.contactPhone.value;
    orm.memo = state.memo;
    orm.distanceKm = state.distanceKm;
    orm.durationMinutes = state.durationMinutes;
    orm.fareAmount = state.fare.amount;
    orm.cancellationFee = state.cancellationFee.amount;
    orm.foodAmount = delivery.foodAmount;
    orm.doorPayment = delivery.doorPayment;
    orm.collectedMethod = delivery.collectedMethod;
    orm.collectedAmount = delivery.collectedAmount;
    orm.cashHandedAt = delivery.cashHandedAt;
    orm.readyAt = delivery.readyAt;
    orm.estimatedPickupAt = state.estimatedPickupAt;
    orm.requestedAt = state.requestedAt;
    orm.assignedAt = state.assignedAt;
    orm.departedAt = state.departedAt;
    orm.arrivedAt = state.arrivedAt;
    orm.pickedUpAt = state.pickedUpAt;
    orm.deliveredAt = state.deliveredAt;
    orm.cancelledAt = state.cancelledAt;
    orm.cancelReason = state.cancelReason;
    return orm;
  }

  static toDomain(orm: OrderOrmEntity): Order {
    return Order.restore(
      {
        id: orm.id,
        customerId: orm.customerId,
        storeDelivery: {
          storeId: orm.storeId,
          source: orm.source as DeliverySource,
          sourceOrderId: orm.sourceOrderId,
          foodAmount: orm.foodAmount,
          doorPayment: orm.doorPayment as DoorPayment,
          readyAt: orm.readyAt,
          collectedMethod: orm.collectedMethod as CollectedMethod | null,
          collectedAmount: orm.collectedAmount,
          cashHandedAt: orm.cashHandedAt,
        },
        pickup: Waypoint.of({
          address: orm.pickupAddress,
          detailAddress: orm.pickupDetailAddress,
          sigungu: orm.pickupSigungu,
          dong: orm.pickupDong,
          latitude: orm.pickupLatitude,
          longitude: orm.pickupLongitude,
          contactName: orm.pickupContactName,
          contactPhone: orm.pickupContactPhone,
        }),
        dropoff: Waypoint.of({
          address: orm.dropoffAddress,
          detailAddress: orm.dropoffDetailAddress,
          sigungu: orm.dropoffSigungu,
          dong: orm.dropoffDong,
          latitude: orm.dropoffLatitude,
          longitude: orm.dropoffLongitude,
          contactName: orm.dropoffContactName,
          contactPhone: orm.dropoffContactPhone,
        }),
        memo: orm.memo,
        distanceKm: orm.distanceKm,
        durationMinutes: orm.durationMinutes,
        fare: Money.won(orm.fareAmount),
        status: orm.status as OrderStatus,
        driverId: orm.driverId,
        estimatedPickupAt: orm.estimatedPickupAt,
        requestedAt: orm.requestedAt,
        assignedAt: orm.assignedAt,
        departedAt: orm.departedAt,
        arrivedAt: orm.arrivedAt,
        pickedUpAt: orm.pickedUpAt,
        deliveredAt: orm.deliveredAt,
        cancelledAt: orm.cancelledAt,
        cancelReason: orm.cancelReason,
        cancellationFee: Money.won(orm.cancellationFee),
      },
      orm.version,
    );
  }
}
