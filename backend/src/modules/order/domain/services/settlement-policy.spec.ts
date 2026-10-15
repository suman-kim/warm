import { InvalidArgumentError } from '../../../../common/domain/domain-error.js';
import { SettlementPolicy, weekOf, weekStartOf } from './settlement-policy.js';

const at = (iso: string) => new Date(iso);
const TUESDAY = 2;
const FRIDAY = 5;

describe('SettlementPolicy', () => {
  describe('수수료', () => {
    const policy = new SettlementPolicy(10, TUESDAY);

    it('요금의 10%를 떼고 나머지를 기사에게 준다', () => {
      expect(policy.feeOf(28000)).toBe(2800);
      expect(policy.earningOf(28000)).toBe(25200);
    });

    it('수수료는 10원 단위로 반올림한다', () => {
      const odd = new SettlementPolicy(12.5, TUESDAY);
      // 8,900원의 12.5% = 1,112.5원 → 1,110원
      expect(odd.feeOf(8900)).toBe(1110);
      expect(odd.earningOf(8900)).toBe(7790);
    });

    it('수수료율이 0이면 요금 전액이 기사에게 간다', () => {
      const free = new SettlementPolicy(0, TUESDAY);
      expect(free.feeOf(28000)).toBe(0);
      expect(free.earningOf(28000)).toBe(28000);
    });

    it('수수료율과 지급 요일이 범위를 벗어나면 만들 수 없다', () => {
      expect(() => new SettlementPolicy(100, TUESDAY)).toThrow(
        InvalidArgumentError,
      );
      expect(() => new SettlementPolicy(-1, TUESDAY)).toThrow(
        InvalidArgumentError,
      );
      expect(() => new SettlementPolicy(10, 7)).toThrow(InvalidArgumentError);
    });
  });

  describe('한 주', () => {
    it('주는 한국 시간 월요일 0시에 시작한다', () => {
      // 2026-10-13은 화요일
      expect(weekStartOf(at('2026-10-13T12:00:00+09:00'))).toEqual(
        at('2026-10-12T00:00:00+09:00'),
      );
      // 일요일 밤은 아직 그 주다
      expect(weekStartOf(at('2026-10-18T23:59:59+09:00'))).toEqual(
        at('2026-10-12T00:00:00+09:00'),
      );
      // UTC로는 일요일이지만 한국은 이미 월요일이다
      expect(weekStartOf(at('2026-10-18T15:30:00Z'))).toEqual(
        at('2026-10-19T00:00:00+09:00'),
      );
    });

    it('한 주는 월요일부터 다음 월요일 전까지다', () => {
      expect(weekOf(at('2026-10-05T00:00:00+09:00'))).toEqual({
        from: at('2026-10-05T00:00:00+09:00'),
        to: at('2026-10-12T00:00:00+09:00'),
      });
    });
  });

  describe('지급일', () => {
    const lastWeek = at('2026-10-05T00:00:00+09:00');

    it('한 주가 끝난 뒤 처음 오는 지급 요일에 준다', () => {
      expect(new SettlementPolicy(10, TUESDAY).payoutDateOf(lastWeek)).toEqual(
        at('2026-10-13T00:00:00+09:00'),
      );
      expect(new SettlementPolicy(10, FRIDAY).payoutDateOf(lastWeek)).toEqual(
        at('2026-10-16T00:00:00+09:00'),
      );
      // 월요일 지급이면 주가 끝난 바로 다음 날이다
      expect(new SettlementPolicy(10, 1).payoutDateOf(lastWeek)).toEqual(
        at('2026-10-12T00:00:00+09:00'),
      );
      // 일요일 지급이면 다음 주의 마지막 날이다
      expect(new SettlementPolicy(10, 0).payoutDateOf(lastWeek)).toEqual(
        at('2026-10-18T00:00:00+09:00'),
      );
    });
  });

  describe('다음 정산', () => {
    const policy = new SettlementPolicy(10, TUESDAY);

    it('지급일 전이면 지난주가 이번 지급일에 정산된다', () => {
      // 월요일 → 내일(화)이 지급일, 대상은 지난주
      expect(policy.upcoming(at('2026-10-12T09:00:00+09:00'))).toEqual({
        payoutDate: at('2026-10-13T00:00:00+09:00'),
        period: {
          from: at('2026-10-05T00:00:00+09:00'),
          to: at('2026-10-12T00:00:00+09:00'),
        },
      });
    });

    it('오늘이 지급일이면 오늘이다', () => {
      expect(
        policy.upcoming(at('2026-10-13T23:00:00+09:00')).payoutDate,
      ).toEqual(at('2026-10-13T00:00:00+09:00'));
    });

    it('지급일이 지났으면 이번 주가 다음 주 지급일에 정산된다', () => {
      // 수요일 → 다음 화요일, 대상은 이번 주
      expect(policy.upcoming(at('2026-10-14T00:10:00+09:00'))).toEqual({
        payoutDate: at('2026-10-20T00:00:00+09:00'),
        period: {
          from: at('2026-10-12T00:00:00+09:00'),
          to: at('2026-10-19T00:00:00+09:00'),
        },
      });
    });
  });
  describe('compensationOf', () => {
    it('취소 수수료 중 기사의 몫을 10원 단위로 준다 (기본은 0%)', () => {
      expect(new SettlementPolicy(10, TUESDAY).compensationOf(6600)).toBe(0);
      expect(new SettlementPolicy(10, TUESDAY, 50).compensationOf(6650)).toBe(
        3330,
      );
      expect(() => new SettlementPolicy(10, TUESDAY, 101)).toThrow(
        InvalidArgumentError,
      );
    });
  });
});
