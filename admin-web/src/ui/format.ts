// 화면에 보이는 글자를 만드는 함수들. 날짜와 시각은 늘 한국 시간으로 보여 준다 —
// 운영자의 컴퓨터가 어느 시간대에 있든 주문·정산의 '하루'가 서버와 같아야 한다.

import type { DocumentType, VehicleType } from "../api/types";

const KST = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});
const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
const DAY_MS = 86_400_000;

function kstParts(at: string | Date) {
  const parts = Object.fromEntries(
    KST.formatToParts(new Date(at)).map((part) => [part.type, part.value]),
  );
  return {
    date: `${parts.year}.${parts.month}.${parts.day}`,
    monthDay: `${parts.month}.${parts.day}`,
    time: `${parts.hour}:${parts.minute}`,
    iso: `${parts.year}-${parts.month}-${parts.day}`,
  };
}

/** 2026.10.13 09:42 */
export function dateTime(at: string): string {
  const { date, time } = kstParts(at);
  return `${date} ${time}`;
}

/** 2026.10.13 */
export function date(at: string): string {
  return kstParts(at).date;
}

/** 10.13 09:42 */
export function shortDateTime(at: string): string {
  const { monthDay, time } = kstParts(at);
  return `${monthDay} ${time}`;
}

/** 10.13 */
export function monthDay(at: string): string {
  return kstParts(at).monthDay;
}

/** 09:42 */
export function time(at: string): string {
  return kstParts(at).time;
}

/** 오늘의 한국 날짜 (YYYY-MM-DD). */
export function todayKst(now: Date = new Date()): string {
  return kstParts(now).iso;
}

/** 한국 날짜(YYYY-MM-DD)에 [days]일을 더한다. */
export function addDays(day: string, days: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + days * DAY_MS)
    .toISOString()
    .slice(0, 10);
}

/** 한국 날짜(YYYY-MM-DD)의 요일 — 월, 화, … */
export function weekday(day: string): string {
  return WEEKDAYS[new Date(`${day}T00:00:00Z`).getUTCDay()];
}

/** 2026-10-13 → 2026.10.13 */
export function dotted(day: string): string {
  return day.replaceAll("-", ".");
}

/** 2026-10-13 → 10.13 */
export function shortDotted(day: string): string {
  return day.slice(5).replace("-", ".");
}

/** 한국 날짜(YYYY-MM-DD)의 0시를 서버에 보낼 ISO 문자열로. */
export function kstMidnight(day: string): string {
  return `${day}T00:00:00+09:00`;
}

/** 그 주가 그 달의 몇째 주인지 — 2026-10-05 → 10월 1주 */
export function weekLabel(weekStart: string): string {
  const month = Number(weekStart.slice(5, 7));
  const day = Number(weekStart.slice(8, 10));
  return `${month}월 ${Math.ceil(day / 7)}주`;
}

/** 28000 → 28,000원 */
export function won(amount: number): string {
  return `${amount.toLocaleString("ko-KR")}원`;
}

/** 01048213307 → 010-4821-3307. 모양이 다르면 그대로 둔다. */
export function phone(digits: string): string {
  const mobile = /^(01\d)(\d{3,4})(\d{4})$/.exec(digits);
  if (mobile) {
    return mobile.slice(1).join("-");
  }
  // 지역번호(02, 031~064)와 070·080만 유선 번호로 본다.
  const landline = /^(02|0[3-6]\d|0[78]0)(\d{3,4})(\d{4})$/.exec(digits);
  return landline ? landline.slice(1).join("-") : digits;
}

/** 경기85자3412 → 경기 85자 3412. 모양이 다르면 그대로 둔다. */
export function plate(number: string): string {
  const match = /^(\D*)(\d{2,3}\D)(\d{4})$/.exec(number);
  return match ? match.slice(1).filter(Boolean).join(" ") : number;
}

/** 2202009 → 2.1MB, 655360 → 640KB */
export function fileSize(bytes: number): string {
  return bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)}MB`
    : `${Math.max(1, Math.round(bytes / 1024))}KB`;
}

const FILE_KINDS: Record<string, string> = {
  "image/jpeg": "JPG",
  "image/png": "PNG",
  "image/webp": "WEBP",
  "image/heic": "HEIC",
  "application/pdf": "PDF",
};

/** image/jpeg → JPG */
export function fileKind(contentType: string | null): string {
  return (contentType && FILE_KINDS[contentType]) || "파일";
}

const VEHICLES: Record<VehicleType, string> = {
  MOTORCYCLE: "오토바이",
  DAMAS: "다마스",
  LABO: "라보",
  TRUCK_1T: "1톤 트럭",
  TRUCK_2_5T: "2.5톤 트럭",
  TRUCK_5T: "5톤 트럭",
};

export function vehicleLabel(type: VehicleType): string {
  return VEHICLES[type] ?? type;
}

const DOCUMENTS: Record<DocumentType, string> = {
  DRIVER_LICENSE: "운전면허증",
  VEHICLE_REGISTRATION: "자동차등록증",
  FREIGHT_QUALIFICATION: "화물운송 종사 자격증",
};

export function documentLabel(type: DocumentType): string {
  return DOCUMENTS[type];
}

/** 주문번호처럼 보이는 짧은 이름 — MV261013-3F9A. 주문 ID의 앞 네 자리를 쓴다. */
export function orderCode(id: string, requestedAt: string): string {
  const day = kstParts(requestedAt).iso.slice(2).replaceAll("-", "");
  return `MV${day}-${id.slice(0, 4).toUpperCase()}`;
}

/** 신청·회원을 가리키는 짧은 이름 — ID의 앞 여덟 자리. */
export function shortId(id: string): string {
  return id.slice(0, 8).toUpperCase();
}
