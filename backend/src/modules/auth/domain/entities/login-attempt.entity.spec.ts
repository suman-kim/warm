import { LoginAttempt } from './login-attempt.entity.js';

const AT = new Date('2026-10-15T01:00:00Z');
const after = (minutes: number) => new Date(AT.getTime() + minutes * 60_000);

describe('LoginAttempt', () => {
  it('15분 안에 다섯 번 틀리면 15분 동안 막는다', () => {
    const attempt = LoginAttempt.first('a@b.dev', AT);
    for (let i = 0; i < 4; i++) {
      expect(attempt.recordFailure(after(i))).toBe(false);
    }
    expect(attempt.isLocked(after(4))).toBe(false);

    expect(attempt.recordFailure(after(4))).toBe(true);
    expect(attempt.isLocked(after(5))).toBe(true);
    expect(attempt.minutesLeft(after(5))).toBe(14);
    expect(attempt.isLocked(after(19))).toBe(false);
  });

  it('15분이 지나면 다시 센다', () => {
    const attempt = LoginAttempt.first('a@b.dev', AT);
    for (let i = 0; i < 4; i++) attempt.recordFailure(after(i));

    expect(attempt.recordFailure(after(20))).toBe(false);
    expect(attempt.failures).toBe(1);
  });
});
