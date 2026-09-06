import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import type { AuthenticatedUser } from '../interfaces/authenticated-user.interface';

/** Header the API answers with (and accepts) so a client can quote one request back to us. */
export const REQUEST_ID_HEADER = 'x-request-id';

/**
 * API Gateway's own id for the invocation. Preferring it keeps our log line
 * joinable with the API Gateway access log and the Lambda report line for the
 * same request; `x-request-id` is the fallback a client (or a local curl) may
 * set itself, and a UUID the last resort.
 */
const API_GATEWAY_REQUEST_ID_HEADER = 'x-amzn-requestid';

/** Fields the middleware attaches to the Express request for the interceptor/filter to read. */
export interface ObservedRequest extends Request {
  requestId?: string;
  startedAt?: bigint;
  // Passport's own augmentation types this as the empty `Express.User`;
  // restating it is what lets the log helpers read `id`/`orgId` off it.
  user?: AuthenticatedUser;
}

/**
 * Assigns a correlation id and a start timestamp to every request, before any
 * guard can reject it — `HttpLoggingInterceptor` and `AllExceptionsFilter` both
 * read them, and a 401 from a guard never reaches an interceptor, so this has to
 * be middleware rather than part of either.
 *
 * Lambda only prefixes its RequestId onto `console.*` output; `JsonLogger` writes
 * straight to stdout, so without this field a CloudWatch Logs Insights query has
 * no way to group the lines belonging to one request.
 */
export function requestContextMiddleware(
  req: ObservedRequest,
  res: Response,
  next: NextFunction,
): void {
  req.requestId = resolveIncomingRequestId(req) ?? randomUUID();
  req.startedAt = process.hrtime.bigint();
  res.setHeader(REQUEST_ID_HEADER, req.requestId);
  next();
}

function resolveIncomingRequestId(req: Request): string | undefined {
  const candidate =
    req.headers[API_GATEWAY_REQUEST_ID_HEADER] ??
    req.headers[REQUEST_ID_HEADER];
  const value = Array.isArray(candidate) ? candidate[0] : candidate;
  // Bounded and stripped: this value is attacker-controlled and ends up in
  // every log line for the request — an unbounded one is a log-injection lever.
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim().slice(0, 128)
    : undefined;
}

/** Milliseconds since `requestContextMiddleware` saw the request, or `undefined` if it never ran. */
export function elapsedMs(req: ObservedRequest): number | undefined {
  if (req.startedAt === undefined) return undefined;
  return Number(process.hrtime.bigint() - req.startedAt) / 1_000_000;
}

/**
 * The *parameterized* route (`/invitations/:token`), never the concrete URL.
 * `/invitations/:token` and `/auth/refresh` carry credentials in the path and
 * cookies respectively; logging `req.originalUrl` would persist an invitation
 * token to CloudWatch for the whole retention window (F9.2 already treats that
 * token as a credential on the frontend side).
 */
export function routePattern(req: Request): string {
  const pattern: unknown = (req as { route?: { path?: unknown } }).route?.path;
  return typeof pattern === 'string' ? pattern : 'unmatched';
}
