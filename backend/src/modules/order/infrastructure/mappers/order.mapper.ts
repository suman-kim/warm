import {
  ServiceType,
  VehicleType,
} from '../../../../common/domain/vehicle-type.js';
import { Order } from '../../domain/entities/order.entity.js';
import { OrderStatus } from '../../domain/order-status.js';
import { LoadingHelp } from '../../domain/services/charge-policy.js';
import { Cargo, CargoCategory } from '../../domain/value-objects/cargo.js';
import { Money } from '../../domain/value-objects/money.js';
import { Waypoint } from '../../domain/value-objects/waypoint.js';
import { OrderOrmEntity } from '../entities/order.orm-entity.js';

/** 주문 도메인 ↔ ORM 매퍼. */
export class OrderMapper {
  static toOrm(order: Order): OrderOrmEntity {
    const state = order.snapshot();
    const orm = new OrderOrmEntity();
    orm.id = state.id;
    orm.customerId = state.customerId;
    orm.driverId = state.driverId;
    orm.serviceType = state.serviceType;
    orm.vehicleType = state.vehicleType;
    orm.status = state.status;
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
    orm.cargoCategory = state.cargo.category;
    orm.cargoDescription = state.cargo.description;
    orm.cargoWeightKg = state.cargo.weightKg;
    orm.cargoQuantity = state.cargo.quantity;
    orm.memo = state.memo;
    orm.distanceKm = state.distanceKm;
    orm.durationMinutes = state.durationMinutes;
    orm.baseFare = state.baseFare.amount;
    orm.loadingHelp = state.loadingHelp;
    orm.helpFee = state.helpFee.amount;
    orm.pickupFloor = state.pickupAccess.floor;
    orm.pickupElevator = state.pickupAccess.elevator;
    orm.dropoffFloor = state.dropoffAccess.floor;
    orm.dropoffElevator = state.dropoffAccess.elevator;
    orm.stairFee = state.stairFee.amount;
    orm.fareAmount = state.fare.amount;
    orm.paymentMethodId = state.paymentMethodId;
    orm.extraOverload = state.extraItems.overload;
    orm.extraBulky = state.extraItems.bulky;
    orm.extraStairs = state.extraItems.stairs;
    orm.extraFee = state.extraFee.amount;
    orm.waitingMinutes = state.waitingMinutes;
    orm.waitingFee = state.waitingFee.amount;
    orm.cancellationFee = state.cancellationFee.amount;
    orm.paymentFailureCode = state.paymentFailureCode;
    orm.scheduledPickupAt = state.scheduledPickupAt;
    orm.estimatedPickupAt = state.estimatedPickupAt;
    orm.requestedAt = state.requestedAt;
    orm.assignedAt = state.assignedAt;
    orm.departedAt = state.departedAt;
    orm.arrivedAt = state.arrivedAt;
    orm.pickedUpAt = state.pickedUpAt;
    orm.deliveredAt = state.deliveredAt;
    orm.cancelledAt = state.cancelledAt;
    orm.noShowAt = state.noShowAt;
    orm.cancelReason = state.cancelReason;
    return orm;
  }

  static toDomain(orm: OrderOrmEntity): Order {
    return Order.restore(
      {
        id: orm.id,
        customerId: orm.customerId,
        serviceType: orm.serviceType as ServiceType,
        vehicleType: orm.vehicleType as VehicleType,
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
        cargo: Cargo.of({
          category: orm.cargoCategory as CargoCategory,
          description: orm.cargoDescription,
          weightKg: orm.cargoWeightKg,
          quantity: orm.cargoQuantity,
        }),
        memo: orm.memo,
        distanceKm: orm.distanceKm,
        durationMinutes: orm.durationMinutes,
        baseFare: Money.won(orm.baseFare),
        loadingHelp: orm.loadingHelp as LoadingHelp,
        helpFee: Money.won(orm.helpFee),
        pickupAccess: { floor: orm.pickupFloor, elevator: orm.pickupElevator },
        dropoffAccess: {
          floor: orm.dropoffFloor,
          elevator: orm.dropoffElevator,
        },
        stairFee: Money.won(orm.stairFee),
        fare: Money.won(orm.fareAmount),
        paymentMethodId: orm.paymentMethodId,
        extraItems: {
          overload: orm.extraOverload,
          bulky: orm.extraBulky,
          stairs: orm.extraStairs,
        },
        extraFee: Money.won(orm.extraFee),
        waitingMinutes: orm.waitingMinutes,
        waitingFee: Money.won(orm.waitingFee),
        cancellationFee: Money.won(orm.cancellationFee),
        paymentFailureCode: orm.paymentFailureCode,
        status: orm.status as OrderStatus,
        driverId: orm.driverId,
        scheduledPickupAt: orm.scheduledPickupAt,
        estimatedPickupAt: orm.estimatedPickupAt,
        requestedAt: orm.requestedAt,
        assignedAt: orm.assignedAt,
        departedAt: orm.departedAt,
        arrivedAt: orm.arrivedAt,
        pickedUpAt: orm.pickedUpAt,
        deliveredAt: orm.deliveredAt,
        cancelledAt: orm.cancelledAt,
        noShowAt: orm.noShowAt,
        cancelReason: orm.cancelReason,
      },
      orm.version,
    );
  }
}
