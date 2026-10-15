import { InvalidArgumentError } from '../../../../common/domain/domain-error.js';
import {
  addDays,
  DAY_MS,
  parseKstDate,
} from '../../../../common/domain/kst.js';
import { Period } from '../../domain/repositories/order.repository.js';

const MAX_DAYS = 92;

/**
 * 한국 날짜 두 개(YYYY-MM-DD, 양 끝 포함)를 기간으로 바꾼다.
 * 형식이 틀렸거나 순서가 뒤집혔거나 너무 길면 InvalidArgumentError.
 */
export function toKstPeriod(from: string, to: string): Period {
  const start = parseKstDate(from);
  const end = parseKstDate(to);
  if (!start || !end || end < start) {
    throw new InvalidArgumentError(
      'INVALID_PERIOD',
      '기간이 올바르지 않아요. 날짜는 YYYY-MM-DD로 보내 주세요.',
    );
  }
  if ((end.getTime() - start.getTime()) / DAY_MS >= MAX_DAYS) {
    throw new InvalidArgumentError(
      'PERIOD_TOO_LONG',
      `기간은 ${MAX_DAYS}일까지 조회할 수 있어요.`,
    );
  }
  return { from: start, to: addDays(end, 1) };
}
