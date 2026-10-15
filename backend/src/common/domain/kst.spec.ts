import {
  addDays,
  kstDateString,
  kstDayOfWeek,
  kstStartOfDay,
  parseKstDate,
} from './kst.js';

describe('KST 날짜 계산', () => {
  it('하루는 한국 시간 0시에 바뀐다 (UTC 15시)', () => {
    const beforeMidnight = new Date('2026-10-13T14:59:59Z');
    const afterMidnight = new Date('2026-10-13T15:00:00Z');

    expect(kstDateString(beforeMidnight)).toBe('2026-10-13');
    expect(kstDateString(afterMidnight)).toBe('2026-10-14');
    expect(kstStartOfDay(beforeMidnight)).toEqual(
      new Date('2026-10-12T15:00:00Z'),
    );
    expect(kstStartOfDay(afterMidnight)).toEqual(afterMidnight);
  });

  it('요일도 한국 날짜를 따른다', () => {
    // 2026-10-13은 화요일. UTC로는 아직 화요일이어도 한국은 수요일일 수 있다.
    expect(kstDayOfWeek(new Date('2026-10-13T03:00:00Z'))).toBe(2);
    expect(kstDayOfWeek(new Date('2026-10-13T16:00:00Z'))).toBe(3);
  });

  it('YYYY-MM-DD를 한국 날짜의 0시로 읽는다', () => {
    expect(parseKstDate('2026-10-13')).toEqual(
      new Date('2026-10-12T15:00:00Z'),
    );
  });

  it('형식이 틀렸거나 없는 날짜는 읽지 않는다', () => {
    expect(parseKstDate('2026-2-3')).toBeNull();
    expect(parseKstDate('20261013')).toBeNull();
    expect(parseKstDate('2026-13-01')).toBeNull();
    expect(parseKstDate('2026-02-30')).toBeNull();
    expect(parseKstDate('2026-10-13T00:00:00Z')).toBeNull();
  });

  it('날짜를 더하고 뺀다', () => {
    const day = parseKstDate('2026-10-31')!;

    expect(kstDateString(addDays(day, 1))).toBe('2026-11-01');
    expect(kstDateString(addDays(day, -31))).toBe('2026-09-30');
  });
});
