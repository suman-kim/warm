import { AggregateRoot } from '../../../../common/domain/aggregate-root.js';
import { InvalidArgumentError } from '../../../../common/domain/domain-error.js';
import {
  addDays,
  kstDateString,
  kstDayOfWeek,
  parseKstDate,
} from '../../../../common/domain/kst.js';

/** 음식 종류. 손님 앱 홈의 카테고리다. */
export enum FoodCategory {
  CHICKEN = 'CHICKEN',
  PIZZA = 'PIZZA',
  KOREAN = 'KOREAN',
  CHINESE = 'CHINESE',
  JAPANESE = 'JAPANESE',
  WESTERN = 'WESTERN',
  /** 분식 */
  SNACK = 'SNACK',
  /** 족발·보쌈 */
  JOKBAL = 'JOKBAL',
  /** 카페·디저트 */
  CAFE = 'CAFE',
  FAST_FOOD = 'FAST_FOOD',
  ASIAN = 'ASIAN',
  /** 도시락 */
  LUNCHBOX = 'LUNCHBOX',
  /** 야식 */
  LATE_NIGHT = 'LATE_NIGHT',
  OTHER = 'OTHER',
}

/** 하루의 영업시간 (한국 시간, HH:MM). [close]가 [open]보다 이르면 다음 날 새벽까지 연다. */
export interface DayHours {
  open: string;
  close: string;
}

/** 주문금액별 배달팁: 메뉴 금액이 [minOrderAmount] 이상이면 [tip]. 가장 큰 기준을 쓴다. */
export interface DeliveryTipRule {
  minOrderAmount: number;
  tip: number;
}

/** 거리별 추가 배달팁: 가게에서 [overKm]보다 멀면 [extra]를 더한다. 가장 큰 기준을 쓴다. */
export interface DistanceTipRule {
  overKm: number;
  extra: number;
}

/** 사장님이 정하는 가게 운영 설정. */
export interface StorefrontSettings {
  category: FoodCategory;
  description: string | null;
  /** 원산지 표시 (가게 전체) */
  originNotice: string | null;
  /** 최소 주문 금액 (메뉴 금액 기준) */
  minOrderAmount: number;
  /** 배달하는 거리 (직선 km) */
  maxDeliveryKm: number;
  deliveryTipRules: DeliveryTipRule[];
  distanceTipRules: DistanceTipRule[];
  /** 요일별 영업시간. 0 = 일요일 … 6 = 토요일. null이면 쉬는 날 */
  businessHours: (DayHours | null)[];
  /** 쉬는 날 (한국 날짜 YYYY-MM-DD) */
  holidays: string[];
}

export interface StorefrontState extends StorefrontSettings {
  storeId: string;
  /** 대표 사진 (파일 보관소 키) */
  logoKey: string | null;
  /** 사장님이 주문 받기를 켰는지 */
  open: boolean;
  /** 임시 휴업이 끝나는 시각 */
  pausedUntil: Date | null;
  /** 운영자가 손님 앱에서 내린 시각과 사유 */
  hiddenAt: Date | null;
  hiddenReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** 손님이 지금 주문할 수 없는 이유. */
export enum ClosedReason {
  /** 사장님이 주문 받기를 켜지 않았다 */
  NOT_OPENED = 'NOT_OPENED',
  /** 운영자가 손님 앱에서 내렸다 */
  HIDDEN = 'HIDDEN',
  /** 임시 휴업 */
  PAUSED = 'PAUSED',
  /** 쉬는 날 */
  HOLIDAY = 'HOLIDAY',
  /** 영업시간이 아니다 */
  OUTSIDE_HOURS = 'OUTSIDE_HOURS',
}

export const DEFAULT_STOREFRONT_SETTINGS: Readonly<StorefrontSettings> = {
  category: FoodCategory.OTHER,
  description: null,
  originNotice: null,
  minOrderAmount: 12_000,
  maxDeliveryKm: 3,
  deliveryTipRules: [{ minOrderAmount: 0, tip: 3_000 }],
  distanceTipRules: [],
  businessHours: Array.from({ length: 7 }, () => ({
    open: '11:00',
    close: '22:00',
  })),
  holidays: [],
};

/** 배달하는 거리 한도 (km) — 배달대행료 정책의 한도와 같다. */
export const MAX_DELIVERY_KM = 10;
const MAX_PAUSE_MINUTES = 24 * 60;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const CLOSE_TIME = /^(([01]\d|2[0-3]):[0-5]\d|24:00)$/;

/**
 * 주문앱(따끈)에 보이는 가게. 가게 하나에 하나이고, 처음 열어 볼 때 기본 설정으로 만든다.
 * 영업시간·휴무·임시 휴업으로 지금 주문을 받는지 판단하고, 주문금액·거리로 배달팁을 정한다.
 */
export class Storefront extends AggregateRoot {
  private constructor(
    private readonly state: StorefrontState,
    version: number,
  ) {
    super(state.storeId, version);
  }

  static create(storeId: string, now: Date): Storefront {
    return new Storefront(
      {
        storeId,
        ...structuredClone(DEFAULT_STOREFRONT_SETTINGS),
        logoKey: null,
        open: false,
        pausedUntil: null,
        hiddenAt: null,
        hiddenReason: null,
        createdAt: now,
        updatedAt: now,
      },
      0,
    );
  }

  static restore(state: StorefrontState, version: number): Storefront {
    return new Storefront(structuredClone(state), version);
  }

  get storeId(): string {
    return this.state.storeId;
  }

  get maxDeliveryKm(): number {
    return this.state.maxDeliveryKm;
  }

  get minOrderAmount(): number {
    return this.state.minOrderAmount;
  }

  get logoKey(): string | null {
    return this.state.logoKey;
  }

  snapshot(): StorefrontState {
    return structuredClone(this.state);
  }

  updateSettings(settings: StorefrontSettings, now: Date): void {
    Object.assign(this.state, normalizeSettings(settings));
    this.state.updatedAt = now;
  }

  setLogo(key: string, now: Date): void {
    this.state.logoKey = key;
    this.state.updatedAt = now;
  }

  /** 주문 받기 켜기·끄기. 켤 때 메뉴가 있는지는 유스케이스가 확인한다. */
  setOpen(open: boolean, now: Date): void {
    this.state.open = open;
    this.state.updatedAt = now;
  }

  /** 임시 휴업 (최대 24시간). [minutes]가 null이면 휴업을 끝낸다. */
  pause(minutes: number | null, now: Date): void {
    if (minutes === null) {
      this.state.pausedUntil = null;
    } else {
      if (
        !Number.isInteger(minutes) ||
        minutes < 1 ||
        minutes > MAX_PAUSE_MINUTES
      ) {
        throw new InvalidArgumentError(
          'INVALID_PAUSE',
          '임시 휴업은 1분부터 24시간까지 정할 수 있어요.',
        );
      }
      this.state.pausedUntil = new Date(now.getTime() + minutes * 60_000);
    }
    this.state.updatedAt = now;
  }

  /** 운영자가 손님 앱에서 내리거나(사유 필수) 다시 올린다. */
  setHidden(hidden: boolean, reason: string | null, now: Date): void {
    if (hidden) {
      const trimmed = reason?.trim();
      if (!trimmed) {
        throw new InvalidArgumentError(
          'HIDE_REASON_REQUIRED',
          '내리는 사유를 적어 주세요.',
        );
      }
      this.state.hiddenAt = now;
      this.state.hiddenReason = trimmed;
    } else {
      this.state.hiddenAt = null;
      this.state.hiddenReason = null;
    }
    this.state.updatedAt = now;
  }

  /** 지금 주문을 받는지와, 받지 않으면 그 이유. */
  availability(now: Date): ClosedReason | null {
    if (this.state.hiddenAt) return ClosedReason.HIDDEN;
    if (!this.state.open) return ClosedReason.NOT_OPENED;
    if (this.state.pausedUntil && this.state.pausedUntil > now) {
      return ClosedReason.PAUSED;
    }
    return openingAt(this.state, now);
  }

  /** 메뉴 금액과 가게에서의 거리로 정한 배달팁 (손님이 낸다). */
  deliveryTipFor(menuAmount: number, distanceKm: number): number {
    const base = [...this.state.deliveryTipRules]
      .reverse()
      .find((rule) => menuAmount >= rule.minOrderAmount);
    const extra = [...this.state.distanceTipRules]
      .reverse()
      .find((rule) => distanceKm > rule.overKm);
    return (base?.tip ?? 0) + (extra?.extra ?? 0);
  }
}

/** 영업시간·휴무로 본 지금 상태. 열려 있으면 null. */
function openingAt(state: StorefrontState, now: Date): ClosedReason | null {
  const today = kstDateString(now);
  const weekday = kstDayOfWeek(now);
  const minute = minutesOfDay(now);
  // 어젯밤에 열어 새벽까지 이어지는 영업
  const yesterday = kstDateString(addDays(now, -1));
  const last = state.businessHours[(weekday + 6) % 7];
  if (
    last &&
    toMinutes(last.close) < toMinutes(last.open) &&
    minute < toMinutes(last.close) &&
    !state.holidays.includes(yesterday)
  ) {
    return null;
  }
  if (state.holidays.includes(today)) return ClosedReason.HOLIDAY;
  const hours = state.businessHours[weekday];
  if (!hours) return ClosedReason.OUTSIDE_HOURS;
  const open = toMinutes(hours.open);
  const close = toMinutes(hours.close);
  const inside =
    close > open ? minute >= open && minute < close : minute >= open;
  return inside ? null : ClosedReason.OUTSIDE_HOURS;
}

function minutesOfDay(at: Date): number {
  const kst = new Date(at.getTime() + 9 * 60 * 60_000);
  return kst.getUTCHours() * 60 + kst.getUTCMinutes();
}

function toMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

function normalizeSettings(settings: StorefrontSettings): StorefrontSettings {
  if (!Object.values(FoodCategory).includes(settings.category)) {
    throw invalid('INVALID_CATEGORY', '음식 종류를 골라 주세요.');
  }
  const description = text(settings.description, 300, '가게 소개');
  const originNotice = text(settings.originNotice, 1000, '원산지 표시');
  if (!won(settings.minOrderAmount, 100_000)) {
    throw invalid(
      'INVALID_MIN_ORDER',
      '최소 주문 금액은 0원부터 10만 원까지예요.',
    );
  }
  if (
    typeof settings.maxDeliveryKm !== 'number' ||
    settings.maxDeliveryKm < 0.5 ||
    settings.maxDeliveryKm > MAX_DELIVERY_KM ||
    Math.round(settings.maxDeliveryKm * 10) !== settings.maxDeliveryKm * 10
  ) {
    throw invalid(
      'INVALID_DELIVERY_DISTANCE',
      `배달 거리는 0.5km부터 ${MAX_DELIVERY_KM}km까지, 0.1km 단위로 정해 주세요.`,
    );
  }
  const tips = settings.deliveryTipRules ?? [];
  if (
    tips.length > 10 ||
    (tips.length > 0 && tips[0].minOrderAmount !== 0) ||
    tips.some(
      (rule, index) =>
        !won(rule.minOrderAmount, 1_000_000) ||
        !won(rule.tip, 20_000) ||
        (index > 0 && rule.minOrderAmount <= tips[index - 1].minOrderAmount),
    )
  ) {
    throw invalid(
      'INVALID_DELIVERY_TIP',
      '배달팁은 0원 기준부터 주문금액 순서로, 팁은 2만 원까지 정해 주세요.',
    );
  }
  const extras = settings.distanceTipRules ?? [];
  if (
    extras.length > 10 ||
    extras.some(
      (rule, index) =>
        typeof rule.overKm !== 'number' ||
        rule.overKm <= 0 ||
        rule.overKm >= MAX_DELIVERY_KM ||
        Math.round(rule.overKm * 10) !== rule.overKm * 10 ||
        !won(rule.extra, 10_000) ||
        (index > 0 && rule.overKm <= extras[index - 1].overKm),
    )
  ) {
    throw invalid(
      'INVALID_DISTANCE_TIP',
      '거리별 추가 배달팁은 거리 순서로, 0.1km 단위·1만 원까지 정해 주세요.',
    );
  }
  const hours = settings.businessHours ?? [];
  if (
    hours.length !== 7 ||
    hours.some(
      (day) =>
        day !== null &&
        (!TIME.test(day.open) ||
          !CLOSE_TIME.test(day.close) ||
          day.open === day.close),
    )
  ) {
    throw invalid(
      'INVALID_BUSINESS_HOURS',
      '영업시간은 요일마다(일~토) 여는 시각과 닫는 시각을 HH:MM으로 정해 주세요.',
    );
  }
  const holidays = [...new Set(settings.holidays ?? [])].sort();
  if (holidays.length > 60 || holidays.some((date) => !parseKstDate(date))) {
    throw invalid(
      'INVALID_HOLIDAYS',
      '쉬는 날은 YYYY-MM-DD로 60개까지 정해 주세요.',
    );
  }
  return {
    category: settings.category,
    description,
    originNotice,
    minOrderAmount: settings.minOrderAmount,
    maxDeliveryKm: settings.maxDeliveryKm,
    deliveryTipRules: tips.map((rule) => ({ ...rule })),
    distanceTipRules: extras.map((rule) => ({ ...rule })),
    businessHours: hours.map((day) =>
      day ? { open: day.open, close: day.close } : null,
    ),
    holidays,
  };
}

function won(value: number, max: number): boolean {
  return Number.isInteger(value) && value >= 0 && value <= max;
}

function text(value: string | null, max: number, label: string): string | null {
  const trimmed = value?.trim() || null;
  if (trimmed && trimmed.length > max) {
    throw invalid('TEXT_TOO_LONG', `${label}는 ${max}자까지 쓸 수 있어요.`);
  }
  return trimmed;
}

function invalid(code: string, message: string): InvalidArgumentError {
  return new InvalidArgumentError(code, message);
}
