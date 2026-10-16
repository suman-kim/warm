// 화면에 보이는 글자를 만드는 함수들. 날짜와 시각은 늘 한국 시간으로 보여 준다.

import type {
  DoorPayment,
  Order,
  OrderStatus,
  StoreAddress,
} from "../api/types";

const KST = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});
const DAY_MS = 86_400_000;

function kstParts(at: string | Date) {
  const parts = Object.fromEntries(
    KST.formatToParts(new Date(at)).map((part) => [part.type, part.value]),
  );
  return {
    iso: `${parts.year}-${parts.month}-${parts.day}`,
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: parts.minute,
  };
}

/** 오늘의 한국 날짜 (YYYY-MM-DD) */
export function todayKst(now: Date = new Date()): string {
  return kstParts(now).iso;
}

/** [day]에서 [days]일 뒤의 한국 날짜 */
export function addDays(day: string, days: number): string {
  return todayKst(
    new Date(Date.parse(`${day}T12:00:00+09:00`) + days * DAY_MS),
  );
}

/** 오후 7:32 */
export function ampm(at: string | Date): string {
  const { hour, minute } = kstParts(at);
  return `${hour < 12 ? "오전" : "오후"} ${hour % 12 || 12}:${minute}`;
}

/** 7:32 (오전/오후 없이) */
export function clock(at: string | Date): string {
  const { hour, minute } = kstParts(at);
  return `${hour % 12 || 12}:${minute}`;
}

/** 10.15 오후 7:31 */
export function monthDayTime(at: string): string {
  const { month, day } = kstParts(at);
  return `${month}.${String(day).padStart(2, "0")} ${ampm(at)}`;
}

/** 오늘 오후 7:31 / 어제 오후 3:00 / 10.13 오후 9:42 */
export function relativeTime(at: string, now: Date = new Date()): string {
  const day = kstParts(at).iso;
  if (day === todayKst(now)) return ampm(at);
  if (day === addDays(todayKst(now), -1)) return `어제 ${ampm(at)}`;
  return monthDayTime(at);
}

/** 2026.10.02 */
export function dotted(at: string): string {
  return kstParts(at).iso.replaceAll("-", ".");
}

/** 84500 → 84,500원 */
export function won(amount: number): string {
  return `${amount.toLocaleString("ko-KR")}원`;
}

/** 01048213307 → 010-4821-3307, 025551234 → 02-555-1234, 050412345678 → 0504-1234-5678 */
export function phone(digits: string): string {
  const d = digits.replace(/\D/g, "");
  if (d.startsWith("02") && d.length >= 9) {
    return `02-${d.slice(2, -4)}-${d.slice(-4)}`;
  }
  if (d.length === 12) return `${d.slice(0, 4)}-${d.slice(4, 8)}-${d.slice(8)}`;
  if (d.length >= 10)
    return `${d.slice(0, 3)}-${d.slice(3, -4)}-${d.slice(-4)}`;
  return digits;
}

/** 2208162517 → 220-81-62517 */
export function businessNumber(digits: string): string {
  const match = /^(\d{3})(\d{2})(\d{5})$/.exec(digits);
  return match ? match.slice(1).join("-") : digits;
}

/** 서울강남가1234 → 서울 강남 가 1234 */
export function plate(number: string): string {
  const compact = number.replaceAll(" ", "");
  const bike = /^([가-힣]{2})([가-힣]{1,3})([가-힣])(\d{4})$/.exec(compact);
  if (bike) return bike.slice(1).join(" ");
  const car = /^(\D*)(\d{2,3}\D)(\d{4})$/.exec(compact);
  return car ? car.slice(1).filter(Boolean).join(" ") : number;
}

/** 주문번호 끝 4자리 (MV261015-3F9A → 3F9A) */
export function shortCode(order: Order): string {
  return order.code.slice(-4);
}

/** 서울 강남구 역삼로 180 → 역삼로 180 */
export function roadOnly(address: string): string {
  const parts = address.trim().split(/\s+/);
  return parts.length > 2 ? parts.slice(-2).join(" ") : address;
}

export function storeAddressLine(address: StoreAddress): string {
  return [address.address, address.detailAddress].filter(Boolean).join(" ");
}

export const PAYMENTS: Record<DoorPayment, string> = {
  PREPAID: "선결제",
  CASH: "만나서 현금",
  CARD: "만나서 카드",
};

/** 선결제 / 만나서 현금 23,000원 */
export function paymentLine(order: Order): string {
  const delivery = order.storeDelivery;
  if (!delivery) return "";
  return delivery.doorPayment === "PREPAID"
    ? "선결제"
    : `${PAYMENTS[delivery.doorPayment]} ${won(delivery.foodAmount)}`;
}

/** 진행 중인지 (요청 ~ 배달 중) */
export function isActive(status: OrderStatus): boolean {
  return !["DELIVERED", "CANCELLED"].includes(status);
}

/** 상태 꼬리표의 이름과 색 (가게 앱과 같다) */
export function statusChip(status: OrderStatus): {
  label: string;
  className: string;
} {
  switch (status) {
    case "REQUESTED":
      return { label: "라이더 찾는 중", className: "bg-lime text-ink" };
    case "ASSIGNED":
    case "DEPARTED":
      return { label: "가게로 오는 중", className: "bg-ink text-white" };
    case "ARRIVED":
      return { label: "라이더 가게 도착", className: "bg-ink text-lime" };
    case "PICKED_UP":
      return { label: "배달 중", className: "bg-well text-ink" };
    case "DELIVERED":
      return { label: "배달 완료", className: "bg-hair text-sub" };
    default:
      return { label: "취소됨", className: "bg-danger-soft text-danger" };
  }
}

/** 두 곳 사이의 직선 거리(km) */
export function distanceKm(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
): number {
  const rad = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = rad(b.latitude - a.latitude);
  const dLng = rad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.latitude)) *
      Math.cos(rad(b.latitude)) *
      Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}
