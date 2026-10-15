import { InvalidArgumentError } from '../../../../common/domain/domain-error.js';
import { ChargePolicy, LoadingHelp } from './charge-policy.js';

const AT = new Date('2026-10-14T05:00:00Z');
const minutesAfter = (minutes: number) =>
  new Date(AT.getTime() + minutes * 60_000);

describe('ChargePolicy', () => {
  it('운반 도움은 함께 1만 원, 기사 혼자 2만 원이다', () => {
    expect(ChargePolicy.helpFee(LoadingHelp.NONE)).toBe(0);
    expect(ChargePolicy.helpFee(LoadingHelp.TOGETHER)).toBe(10000);
    expect(ChargePolicy.helpFee(LoadingHelp.DRIVER_ONLY)).toBe(20000);
  });

  it('엘리베이터가 없는 곳만 2층부터 한 층에 3천 원을 붙인다', () => {
    expect(
      ChargePolicy.stairFee(
        { floor: 3, elevator: false },
        { floor: 5, elevator: true },
      ),
    ).toBe(6000);
    expect(
      ChargePolicy.stairFee(
        { floor: 1, elevator: false },
        { floor: 2, elevator: false },
      ),
    ).toBe(3000);
  });

  it('추가 요금은 수량에 단가를 곱한다', () => {
    expect(ChargePolicy.extraFee({ overload: 1, bulky: 2, stairs: 3 })).toBe(
      10000 + 20000 + 9000,
    );
  });

  it('대기료는 10분까지 무료이고, 그 뒤 1분에 500원이다', () => {
    expect(ChargePolicy.waitingMinutes(AT, minutesAfter(14.9))).toBe(14);
    expect(ChargePolicy.waitingFee(10)).toBe(0);
    expect(ChargePolicy.waitingFee(14)).toBe(2000);
  });

  it('출발 뒤 취소 수수료는 요금의 15%를 100원 단위로 반올림한다', () => {
    expect(ChargePolicy.cancellationFee(44000)).toBe(6600);
    expect(ChargePolicy.cancellationFee(33200)).toBe(5000);
    expect(ChargePolicy.cancellationFee(25000)).toBe(3800);
  });

  it('노쇼는 도착하고 30분이 지나야 신고할 수 있다', () => {
    expect(ChargePolicy.canReportNoShow(AT, minutesAfter(29))).toBe(false);
    expect(ChargePolicy.canReportNoShow(AT, minutesAfter(30))).toBe(true);
    expect(ChargePolicy.noShowAvailableAt(AT)).toEqual(minutesAfter(30));
  });

  it('층과 추가 요금 수량의 범위를 확인한다', () => {
    expect(() =>
      ChargePolicy.assertFloorAccess({ floor: 100, elevator: true }),
    ).toThrow(InvalidArgumentError);
    expect(() =>
      ChargePolicy.assertExtraItems({ overload: 0, bulky: 31, stairs: 0 }),
    ).toThrow(InvalidArgumentError);
    expect(() =>
      ChargePolicy.assertExtraItems({ overload: 0.5, bulky: 0, stairs: 0 }),
    ).toThrow(InvalidArgumentError);
  });
});
