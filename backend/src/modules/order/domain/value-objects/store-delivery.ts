import { InvalidArgumentError } from '../../../../common/domain/domain-error.js';

/** 음식값을 어떻게 받는지. */
export enum DoorPayment {
  /** 배달앱에서 이미 결제했다 — 라이더는 돈을 받지 않는다. */
  PREPAID = 'PREPAID',
  /** 만나서 현금 */
  CASH = 'CASH',
  /** 만나서 카드 (라이더의 휴대용 단말기) */
  CARD = 'CARD',
}

/** 라이더가 손님에게 실제로 받은 방식. */
export type CollectedMethod = DoorPayment.CASH | DoorPayment.CARD;

/** 배달이 어디서 왔는지. */
export enum DeliverySource {
  /** 가게가 직접 요청했다 — 대행료는 충전금에서 빠진다. */
  STORE_REQUEST = 'STORE_REQUEST',
  /** 손님이 주문앱(따끈)으로 주문했고 가게가 접수했다 — 대행료는 가게 정산에서 뺀다. */
  FOOD_ORDER = 'FOOD_ORDER',
}

/**
 * 가게 배달의 정보: 어느 가게의 배달인지, 음식값과 받는 방식, 조리 완료 시각, 받은 돈.
 * 배달대행료는 요청할 때 가게 충전금에서 이미 빠졌다.
 */
export interface StoreDelivery {
  storeId: string;
  /** 어디서 온 배달인지 */
  source: DeliverySource;
  /** 주문앱 주문에서 왔으면 그 주문 ID. 가게가 직접 요청했으면 null. */
  sourceOrderId: string | null;
  /** 손님이 낼 음식값 (원) — 만나서 결제면 라이더가 받는다 */
  foodAmount: number;
  doorPayment: DoorPayment;
  /** 가게가 정한 픽업 가능 시각 (조리 완료). 바로면 null. */
  readyAt: Date | null;
  /** 배달 완료 때 라이더가 받은 방식과 금액. 선결제거나 아직 안 끝났으면 null. */
  collectedMethod: CollectedMethod | null;
  collectedAmount: number | null;
  /** 라이더가 받은 현금을 가게에 넘긴 시각 (운영자가 확인해 표시한다). 아직이면 null. */
  cashHandedAt: Date | null;
}

/** 배차 지연: 요청하고 이만큼(분) 지나도록 라이더가 수락하지 않았다. */
export const DISPATCH_LATE_MINUTES = 10;

/** 픽업 지연: 요청하고 이만큼(분) 지나도록 픽업하지 않았다. */
export const PICKUP_LATE_MINUTES = 20;

/** 음식값 한도 (원) */
const MAX_FOOD_AMOUNT = 1_000_000;

export function newStoreDelivery(input: {
  storeId: string;
  source?: DeliverySource;
  sourceOrderId?: string | null;
  foodAmount: number;
  doorPayment: DoorPayment;
  readyAt: Date | null;
  now: Date;
}): StoreDelivery {
  if (
    !Number.isInteger(input.foodAmount) ||
    input.foodAmount < 0 ||
    input.foodAmount > MAX_FOOD_AMOUNT
  ) {
    throw new InvalidArgumentError(
      'INVALID_FOOD_AMOUNT',
      '음식값이 올바르지 않아요.',
    );
  }
  if (input.doorPayment !== DoorPayment.PREPAID && input.foodAmount === 0) {
    throw new InvalidArgumentError(
      'FOOD_AMOUNT_REQUIRED',
      '만나서 결제하는 주문은 받을 음식값을 적어 주세요.',
    );
  }
  if (
    input.readyAt &&
    input.readyAt.getTime() > input.now.getTime() + 3 * 60 * 60_000
  ) {
    throw new InvalidArgumentError(
      'READY_AT_TOO_LATE',
      '픽업 가능 시각은 3시간 안으로 정해 주세요.',
    );
  }
  return {
    storeId: input.storeId,
    source: input.source ?? DeliverySource.STORE_REQUEST,
    sourceOrderId: input.sourceOrderId ?? null,
    foodAmount: input.foodAmount,
    doorPayment: input.doorPayment,
    readyAt: input.readyAt && input.readyAt > input.now ? input.readyAt : null,
    collectedMethod: null,
    collectedAmount: null,
    cashHandedAt: null,
  };
}

/**
 * 배달대행료 (가게가 낸다, 부가세 포함).
 * 기본 2km까지 3,500원, 넘으면 1km마다(시작한 km) 500원, 밤 10시~아침 6시(한국 시간)는 500원 더.
 * 10km를 넘으면 받지 않는다.
 * TODO: 임시 값이다. 실제 대행료와 우천·명절 할증은 정해지면 바꾼다 (작업 35.4).
 */
export const DeliveryFeePolicy = {
  BASE_FEE: 3_500,
  BASE_KM: 2,
  PER_KM: 500,
  NIGHT_SURCHARGE: 500,
  MAX_KM: 10,
  /** 라이더가 출발(또는 가게 도착)한 뒤 취소하면 대행료의 이만큼(%)을 수수료로 뗀다 */
  CANCELLATION_FEE_PERCENT: 15,

  feeFor(distanceKm: number, at: Date): number {
    if (distanceKm > this.MAX_KM) {
      throw new InvalidArgumentError(
        'DELIVERY_TOO_FAR',
        `가게에서 ${this.MAX_KM}km 안까지 배달할 수 있어요.`,
      );
    }
    const extraKm = Math.max(0, Math.ceil(distanceKm - this.BASE_KM));
    return (
      this.BASE_FEE +
      extraKm * this.PER_KM +
      (isNight(at) ? this.NIGHT_SURCHARGE : 0)
    );
  },

  /** 취소 수수료 — 대행료의 15%, 원 단위로 반올림한다 (3,500원 → 525원). */
  cancellationFee(fee: number): number {
    return Math.round((fee * this.CANCELLATION_FEE_PERCENT) / 100);
  },
};

/** 한국 시간(UTC+9)으로 밤 10시~아침 6시인지. */
function isNight(at: Date): boolean {
  const hour = (at.getUTCHours() + 9) % 24;
  return hour >= 22 || hour < 6;
}
