import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import type { Response } from 'express';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import type { AuthenticatedUser } from '../interfaces/authenticated-user.interface';
import {
  elapsedMs,
  routePattern,
  type ObservedRequest,
} from './request-context';

/**
 * One structured line per *successful* request. Failures are logged by
 * `AllExceptionsFilter` instead — it is the only place that sees the final
 * status of a request rejected by a guard (a 401/403/429 never reaches an
 * interceptor), so splitting the two keeps the invariant "exactly one
 * `http_request` line per request" rather than logging some requests twice.
 *
 * Deliberately never logs the request body, the query string or the concrete
 * URL: bodies carry passwords (`/auth/login`) and paths carry invitation
 * tokens, and CloudWatch keeps whatever it is handed for the full retention
 * window.
 */
@Injectable()
export class HttpLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HttpRequest');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();

    const http = context.switchToHttp();
    const request = http.getRequest<ObservedRequest>();
    const response = http.getResponse<Response>();

    return next.handle().pipe(
      tap({
        next: () => {
          this.logger.log({
            event: 'http_request',
            requestId: request.requestId,
            method: request.method,
            route: routePattern(request),
            handler: `${context.getClass().name}.${context.getHandler().name}`,
            statusCode: response.statusCode,
            durationMs: round(elapsedMs(request)),
            ...actorFields(request),
          });
        },
      }),
    );
  }
}

/**
 * Who made the call, by id only — the org id is what makes "did tenant X see
 * tenant Y's data?" answerable from the logs, and ids (unlike emails or names)
 * aren't personal data sitting in a log group.
 */
export function actorFields(request: {
  user?: AuthenticatedUser;
}): Record<string, string> {
  const user = request.user;
  if (!user) return {};
  return { userId: user.id, orgId: user.orgId };
}

/** Two decimals: sub-millisecond precision is noise, but 0 for a fast route reads as "unmeasured". */
export function round(value: number | undefined): number | undefined {
  return value === undefined ? undefined : Math.round(value * 100) / 100;
}
