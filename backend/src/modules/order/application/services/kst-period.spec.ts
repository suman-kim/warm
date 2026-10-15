import { InvalidArgumentError } from '../../../../common/domain/domain-error.js';
import { toKstPeriod } from './kst-period.js';

describe('toKstPeriod', () => {
  it('양 끝 날짜를 포함하는 기간으로 바꾼다', () => {
    expect(toKstPeriod('2026-10-12', '2026-10-18')).toEqual({
      from: new Date('2026-10-11T15:00:00Z'),
      to: new Date('2026-10-18T15:00:00Z'),
    });
  });

  it('하루만 볼 수도 있다', () => {
    const { from, to } = toKstPeriod('2026-10-13', '2026-10-13');

    expect(to.getTime() - from.getTime()).toBe(24 * 60 * 60 * 1000);
  });

  it('형식이 틀렸거나 순서가 뒤집히면 거절한다', () => {
    expect(() => toKstPeriod('2026/10/12', '2026-10-18')).toThrow(
      InvalidArgumentError,
    );
    expect(() => toKstPeriod('2026-10-18', '2026-10-12')).toThrow(
      InvalidArgumentError,
    );
  });

  it('92일까지만 조회한다', () => {
    expect(() => toKstPeriod('2026-01-01', '2026-04-02')).not.toThrow();
    expect(() => toKstPeriod('2026-01-01', '2026-04-03')).toThrow(
      InvalidArgumentError,
    );
  });
});
