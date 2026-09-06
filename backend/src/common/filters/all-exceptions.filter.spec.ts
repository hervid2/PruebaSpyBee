import {
  ArgumentsHost,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { AllExceptionsFilter } from './all-exceptions.filter';
import type { AuthenticatedUser } from '../interfaces/authenticated-user.interface';

interface CapturedResponse {
  status?: number;
  body?: unknown;
}

function createHost(
  overrides: { user?: AuthenticatedUser; route?: { path: string } } = {},
): { host: ArgumentsHost; captured: CapturedResponse } {
  const captured: CapturedResponse = {};
  const response = {
    status(code: number) {
      captured.status = code;
      return this;
    },
    json(body: unknown) {
      captured.body = body;
      return this;
    },
  };
  const request = {
    method: 'POST',
    requestId: 'req-42',
    startedAt: process.hrtime.bigint(),
    ...overrides,
  };

  return {
    captured,
    host: {
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => response,
      }),
    } as unknown as ArgumentsHost,
  };
}

/** `mock.calls` is `any[]`; the logger is only ever called as (entry, trace?). */
type LoggedCall = [Record<string, unknown>, string | undefined];

function callsOf(spy: jest.SpyInstance): LoggedCall[] {
  const calls: unknown = spy.mock.calls;
  return calls as LoggedCall[];
}

describe('AllExceptionsFilter', () => {
  let warn: jest.SpyInstance;
  let error: jest.SpyInstance;

  beforeEach(() => {
    warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
    error = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    warn.mockRestore();
    error.mockRestore();
  });

  describe('a 4xx the API raised on purpose', () => {
    it('keeps the original body so class-validator messages still reach the client', () => {
      const { host, captured } = createHost({ route: { path: '/incidents' } });
      const exception = new BadRequestException(['title should not be empty']);

      new AllExceptionsFilter().catch(exception, host);

      expect(captured.status).toBe(400);
      expect(captured.body).toMatchObject({
        statusCode: 400,
        message: ['title should not be empty'],
        requestId: 'req-42',
      });
    });

    it('logs it as a warning with no stack \u2014 it is an expected outcome, not a defect', () => {
      const { host } = createHost({ route: { path: '/projects/:id' } });

      new AllExceptionsFilter().catch(new ForbiddenException(), host);

      expect(error).not.toHaveBeenCalled();
      expect(warn).toHaveBeenCalledTimes(1);
      expect(callsOf(warn)[0][0]).toMatchObject({
        event: 'http_request',
        requestId: 'req-42',
        method: 'POST',
        route: '/projects/:id',
        statusCode: 403,
        error: 'ForbiddenException',
      });
      expect(callsOf(warn)[0]).toHaveLength(1);
    });

    it('attaches the caller\u2019s ids when the request was authenticated', () => {
      const user: AuthenticatedUser = {
        id: 'u1',
        orgId: 'org-a',
        role: 'member',
        email: 'someone@example.com',
      };
      const { host } = createHost({ user });

      new AllExceptionsFilter().catch(new ForbiddenException(), host);

      expect(callsOf(warn)[0][0]).toMatchObject({
        userId: 'u1',
        orgId: 'org-a',
      });
    });
  });

  describe('an unexpected 5xx', () => {
    it('answers with a generic body carrying only the correlation id', () => {
      const { host, captured } = createHost();
      const leaky = new Error(
        'Invalid `prisma.user.findUnique()` invocation: column "password_hash"',
      );

      new AllExceptionsFilter().catch(leaky, host);

      expect(captured.status).toBe(500);
      expect(captured.body).toEqual({
        statusCode: 500,
        message: 'Internal server error',
        requestId: 'req-42',
      });
      expect(JSON.stringify(captured.body)).not.toContain('password_hash');
    });

    it('logs it at error level with the stack in the trace argument', () => {
      const { host } = createHost({ route: { path: '/incidents' } });
      const boom = new Error('connection pool exhausted');

      new AllExceptionsFilter().catch(boom, host);

      expect(warn).not.toHaveBeenCalled();
      expect(error).toHaveBeenCalledTimes(1);
      const [entry, trace] = callsOf(error)[0];
      expect(entry).toMatchObject({
        event: 'http_request',
        statusCode: 500,
        error: 'Error: connection pool exhausted',
      });
      expect(trace).toContain('all-exceptions.filter.spec');
    });

    it('handles a thrown non-Error without crashing the filter itself', () => {
      const { host, captured } = createHost();

      new AllExceptionsFilter().catch('just a string', host);

      expect(captured.status).toBe(500);
      expect(callsOf(error)[0][0]).toMatchObject({
        error: 'UnknownException',
      });
      expect(callsOf(error)[0][1]).toBeUndefined();
    });
  });
});
