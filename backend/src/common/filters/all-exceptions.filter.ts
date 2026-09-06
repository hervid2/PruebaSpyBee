import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import { actorFields, round } from '../logging/http-logging.interceptor';
import {
  elapsedMs,
  routePattern,
  type ObservedRequest,
} from '../logging/request-context';

/**
 * `HttpException.getStatus()` returns a plain number, so the threshold is one
 * too — comparing it against `HttpStatus.INTERNAL_SERVER_ERROR` mixes an enum
 * with a number, which the lint rules reject for good reason.
 */
const SERVER_ERROR_FLOOR = 500;

/**
 * The single exit point for every failed request: logs it once (with the stack
 * only for 5xx, where there is a defect to debug) and answers with a body that
 * never exposes internals.
 *
 * Nest's built-in filter already hides the stack, but its 500 body is a bare
 * "Internal server error" with nothing to correlate against — a user reporting
 * a failure had no id to quote and no way for us to find their request among
 * the rest. Every response here carries `requestId`, the same value the
 * `x-request-id` response header and the log line hold.
 *
 * 4xx bodies pass through untouched: `class-validator`'s field-level messages
 * are part of the API contract the frontend renders, and several e2e specs
 * assert on them.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('HttpRequest');

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<ObservedRequest>();
    const response = http.getResponse<Response>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
    const isServerError = status >= SERVER_ERROR_FLOOR;

    const entry = {
      event: 'http_request',
      requestId: request.requestId,
      method: request.method,
      route: routePattern(request),
      statusCode: status,
      durationMs: round(elapsedMs(request)),
      error: describe(exception),
      ...actorFields(request),
    };

    if (isServerError) {
      // The stack is the whole point of a 5xx line; it goes to the logger's
      // `trace` field, never into the HTTP response.
      this.logger.error(entry, stackOf(exception));
    } else {
      // Expected outcomes (validation, auth, rate limiting): worth counting and
      // correlating, not worth a stack or an alarm.
      this.logger.warn(entry);
    }

    response.status(status).json(bodyFor(exception, status, request.requestId));
  }
}

/**
 * 4xx keeps Nest's own body; 5xx is replaced wholesale — a Prisma error, for
 * one, carries the failing query and column names in its message.
 */
function bodyFor(
  exception: unknown,
  status: number,
  requestId: string | undefined,
): unknown {
  if (status >= SERVER_ERROR_FLOOR) {
    return {
      statusCode: status,
      message: 'Internal server error',
      ...(requestId ? { requestId } : {}),
    };
  }

  const body: unknown =
    exception instanceof HttpException ? exception.getResponse() : undefined;
  if (typeof body === 'string') {
    return {
      statusCode: status,
      message: body,
      ...(requestId ? { requestId } : {}),
    };
  }
  if (body && typeof body === 'object') {
    return {
      ...(body as Record<string, unknown>),
      ...(requestId ? { requestId } : {}),
    };
  }
  return {
    statusCode: status,
    message: 'Error',
    ...(requestId ? { requestId } : {}),
  };
}

/** A short, safe label for the log line — the full detail lives in the stack. */
function describe(exception: unknown): string {
  if (exception instanceof HttpException) return exception.name;
  if (exception instanceof Error) {
    return `${exception.name}: ${exception.message}`;
  }
  return 'UnknownException';
}

function stackOf(exception: unknown): string | undefined {
  return exception instanceof Error ? exception.stack : undefined;
}
