/** 도메인 오류의 분류. 프레젠테이션 계층이 HTTP 상태 코드로 옮긴다. */
export type DomainErrorKind =
  | 'INVALID'
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'TOO_MANY_REQUESTS'
  | 'UNAVAILABLE';

/**
 * 도메인·애플리케이션 계층이 던지는 오류의 기반 클래스.
 * HTTP를 모른다 — 상태 코드 변환은 HttpExceptionFilter가 맡는다.
 */
export class DomainError extends Error {
  constructor(
    readonly kind: DomainErrorKind,
    /** 클라이언트가 분기할 수 있는 기계용 코드 (예: ORDER_NOT_OPEN). */
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

/** 입력값이 도메인 규칙에 맞지 않는다 (400). */
export class InvalidArgumentError extends DomainError {
  constructor(code: string, message: string) {
    super('INVALID', code, message);
  }
}

/** 누구인지 확인되지 않았다 (401). */
export class UnauthenticatedError extends DomainError {
  constructor(code: string, message: string) {
    super('UNAUTHENTICATED', code, message);
  }
}

/** 누구인지는 알지만 이 작업을 할 수 없다 (403). */
export class ForbiddenError extends DomainError {
  constructor(code: string, message: string) {
    super('FORBIDDEN', code, message);
  }
}

/** 대상을 찾을 수 없다 (404). */
export class NotFoundError extends DomainError {
  constructor(code: string, message: string) {
    super('NOT_FOUND', code, message);
  }
}

/** 현재 상태에서는 할 수 없는 작업이거나 중복·경합이 났다 (409). */
export class ConflictError extends DomainError {
  constructor(code: string, message: string) {
    super('CONFLICT', code, message);
  }
}

/** 짧은 시간에 너무 많이 시도해서 잠시 막았다 (429). */
export class TooManyRequestsError extends DomainError {
  constructor(code: string, message: string) {
    super('TOO_MANY_REQUESTS', code, message);
  }
}

/** 바깥 서비스(주소 검색 등)가 응답하지 않아 지금은 할 수 없다 (503). */
export class UnavailableError extends DomainError {
  constructor(code: string, message: string) {
    super('UNAVAILABLE', code, message);
  }
}
