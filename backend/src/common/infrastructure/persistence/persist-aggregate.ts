import {
  FindOptionsWhere,
  QueryDeepPartialEntity,
  QueryFailedError,
  Repository,
} from 'typeorm';
import { AggregateRoot } from '../../domain/aggregate-root.js';
import { ConflictError } from '../../domain/domain-error.js';

const PG_UNIQUE_VIOLATION = '23505';

/**
 * 애그리거트를 낙관적 잠금으로 저장한다.
 *
 * 새 애그리거트(version 0)는 INSERT, 기존 애그리거트는 읽었을 때의 버전을 조건으로 UPDATE한다.
 * 그사이 다른 요청이 먼저 저장했으면 갱신된 행이 없어 ConflictError가 난다 —
 * 두 기사가 같은 주문을 동시에 수락해도 한 명만 성공하는 근거다.
 */
export async function persistAggregate<
  Row extends { id: string; version: number },
>(
  repository: Repository<Row>,
  aggregate: AggregateRoot,
  row: Row,
): Promise<void> {
  const nextVersion = aggregate.version + 1;
  // undefined인 칸(DB가 채우는 created_at 등)은 건드리지 않는다.
  const values = Object.fromEntries(
    Object.entries({ ...row, version: nextVersion }).filter(
      ([, value]) => value !== undefined,
    ),
  ) as unknown as QueryDeepPartialEntity<Row>;

  if (aggregate.version === 0) {
    try {
      await repository.insert(values);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictError('DUPLICATE_RESOURCE', '이미 등록된 정보예요.');
      }
      throw error;
    }
  } else {
    const result = await repository.update(
      { id: aggregate.id, version: aggregate.version } as FindOptionsWhere<Row>,
      values,
    );
    if (!result.affected) {
      throw new ConflictError(
        'STALE_AGGREGATE',
        '다른 요청이 먼저 처리됐어요. 다시 시도해 주세요.',
      );
    }
  }
  aggregate.markPersisted(nextVersion);
}

/** PostgreSQL 유니크 제약 위반인지. */
export function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof QueryFailedError &&
    (error.driverError as { code?: string }).code === PG_UNIQUE_VIOLATION
  );
}
