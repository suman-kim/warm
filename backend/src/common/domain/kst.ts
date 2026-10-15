// 서비스의 '하루'는 한국 시간(KST, UTC+9) 기준이다. 서버가 어느 시간대에서 돌든
// 오늘 수입·정산일 같은 날짜 계산이 같게 나오도록 여기서만 계산한다.
// 한국은 서머타임이 없어 고정 오프셋으로 충분하다.

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
export const DAY_MS = 24 * 60 * 60 * 1000;

/** 그 시각이 속한 한국 날짜의 0시. */
export function kstStartOfDay(at: Date): Date {
  const shifted = at.getTime() + KST_OFFSET_MS;
  return new Date(shifted - (shifted % DAY_MS) - KST_OFFSET_MS);
}

/** 그 시각의 한국 날짜 (YYYY-MM-DD). */
export function kstDateString(at: Date): string {
  return new Date(at.getTime() + KST_OFFSET_MS).toISOString().slice(0, 10);
}

/** 한국 날짜(YYYY-MM-DD)의 0시. 형식이 틀리면 null. */
export function parseKstDate(date: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return null;
  }
  const parsed = new Date(`${date}T00:00:00+09:00`);
  return Number.isNaN(parsed.getTime()) || kstDateString(parsed) !== date
    ? null
    : parsed;
}

/** 그 시각의 한국 요일. 0 = 일요일 … 6 = 토요일. */
export function kstDayOfWeek(at: Date): number {
  return new Date(at.getTime() + KST_OFFSET_MS).getUTCDay();
}

export function addDays(at: Date, days: number): Date {
  return new Date(at.getTime() + days * DAY_MS);
}
