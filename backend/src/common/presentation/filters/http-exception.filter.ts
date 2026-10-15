import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { DomainError, DomainErrorKind } from '../../domain/domain-error.js';

const STATUS_BY_KIND: Record<DomainErrorKind, HttpStatus> = {
  INVALID: HttpStatus.BAD_REQUEST,
  UNAUTHENTICATED: HttpStatus.UNAUTHORIZED,
  FORBIDDEN: HttpStatus.FORBIDDEN,
  NOT_FOUND: HttpStatus.NOT_FOUND,
  CONFLICT: HttpStatus.CONFLICT,
  TOO_MANY_REQUESTS: HttpStatus.TOO_MANY_REQUESTS,
  UNAVAILABLE: HttpStatus.SERVICE_UNAVAILABLE,
};

interface ErrorBody {
  status: number;
  code: string;
  message: string | string[];
}

/**
 * 전역 예외 필터. 모든 오류를 같은 JSON 형식으로 응답한다.
 * 도메인 오류(DomainError)를 HTTP 상태 코드로 옮기는 유일한 곳이다.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const { status, code, message } = this.toErrorBody(exception);
    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(exception);
    }

    response.status(status).json({
      statusCode: status,
      code,
      message,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }

  private toErrorBody(exception: unknown): ErrorBody {
    if (exception instanceof DomainError) {
      return {
        status: STATUS_BY_KIND[exception.kind],
        code: exception.code,
        message: exception.message,
      };
    }
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      const message =
        typeof body === 'string'
          ? body
          : ((body as { message?: string | string[] }).message ??
            exception.message);
      return {
        status,
        // ValidationPipe는 위반 항목을 배열로 담아 400을 던진다.
        code: Array.isArray(message)
          ? 'VALIDATION_FAILED'
          : (HttpStatus[status] ?? 'HTTP_ERROR'),
        message,
      };
    }
    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      code: 'INTERNAL_SERVER_ERROR',
      message: '서버 오류가 발생했어요. 잠시 후 다시 시도해 주세요.',
    };
  }
}
