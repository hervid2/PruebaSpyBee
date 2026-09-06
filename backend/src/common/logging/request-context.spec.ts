import type { NextFunction, Response } from 'express';
import {
  REQUEST_ID_HEADER,
  elapsedMs,
  requestContextMiddleware,
  routePattern,
  type ObservedRequest,
} from './request-context';

function createRequest(
  headers: Record<string, string | string[]> = {},
): ObservedRequest {
  return { headers } as unknown as ObservedRequest;
}

function createResponse(): { res: Response; headers: Record<string, unknown> } {
  const headers: Record<string, unknown> = {};
  const res = {
    setHeader: (name: string, value: unknown) => {
      headers[name] = value;
    },
  } as unknown as Response;
  return { res, headers };
}

const next: NextFunction = () => undefined;

describe('requestContextMiddleware', () => {
  it('prefers API Gateway\u2019s request id so log lines join its access log', () => {
    const req = createRequest({ 'x-amzn-requestid': 'apigw-abc' });
    const { res, headers } = createResponse();

    requestContextMiddleware(req, res, next);

    expect(req.requestId).toBe('apigw-abc');
    expect(headers[REQUEST_ID_HEADER]).toBe('apigw-abc');
  });

  it('falls back to a client-supplied x-request-id', () => {
    const req = createRequest({ 'x-request-id': 'client-123' });
    requestContextMiddleware(req, createResponse().res, next);
    expect(req.requestId).toBe('client-123');
  });

  it('generates an id when the request carries none', () => {
    const req = createRequest();
    requestContextMiddleware(req, createResponse().res, next);
    expect(req.requestId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('truncates an oversized incoming id \u2014 it is attacker-controlled and lands in every log line', () => {
    const req = createRequest({ 'x-request-id': 'x'.repeat(500) });
    requestContextMiddleware(req, createResponse().res, next);
    expect(req.requestId).toHaveLength(128);
  });

  it('ignores a blank incoming id instead of logging an empty correlation field', () => {
    const req = createRequest({ 'x-request-id': '   ' });
    requestContextMiddleware(req, createResponse().res, next);
    expect(req.requestId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('records a start time that elapsedMs can read back', () => {
    const req = createRequest();
    requestContextMiddleware(req, createResponse().res, next);
    const elapsed = elapsedMs(req);
    expect(elapsed).toBeGreaterThanOrEqual(0);
  });
});

describe('elapsedMs', () => {
  it('returns undefined when the middleware never ran', () => {
    expect(elapsedMs(createRequest())).toBeUndefined();
  });
});

describe('routePattern', () => {
  it('reports the parameterized route, never the concrete URL with its token', () => {
    const req = {
      route: { path: '/invitations/:token' },
      originalUrl: '/invitations/2f9c-secret-token',
    } as unknown as ObservedRequest;

    expect(routePattern(req)).toBe('/invitations/:token');
  });

  it('reports "unmatched" when no route handled the request', () => {
    expect(routePattern(createRequest())).toBe('unmatched');
  });
});
