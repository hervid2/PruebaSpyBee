import { CallHandler, ExecutionContext, Logger } from '@nestjs/common';
import { firstValueFrom, of, throwError } from 'rxjs';
import { HttpLoggingInterceptor } from './http-logging.interceptor';
import type { AuthenticatedUser } from '../interfaces/authenticated-user.interface';

interface RequestOverrides {
  user?: AuthenticatedUser;
  route?: { path: string };
  requestId?: string;
}

function createContext(overrides: RequestOverrides = {}): ExecutionContext {
  const request = {
    method: 'GET',
    requestId: 'req-1',
    startedAt: process.hrtime.bigint(),
    ...overrides,
  };
  return {
    getType: () => 'http',
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => ({ statusCode: 200 }),
    }),
    getClass: () => class IncidentsController {},
    getHandler: () => function list() {},
  } as unknown as ExecutionContext;
}

const handler: CallHandler = { handle: () => of({ ok: true }) };

describe('HttpLoggingInterceptor', () => {
  let logged: jest.SpyInstance;

  beforeEach(() => {
    logged = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    logged.mockRestore();
  });

  function lastEntry(): Record<string, unknown> {
    const calls = logged.mock.calls as unknown as [Record<string, unknown>][];
    return calls[calls.length - 1][0];
  }

  it('emits one structured line per successful request', async () => {
    const interceptor = new HttpLoggingInterceptor();

    await firstValueFrom(
      interceptor.intercept(
        createContext({ route: { path: '/incidents' } }),
        handler,
      ),
    );

    expect(logged).toHaveBeenCalledTimes(1);
    expect(lastEntry()).toMatchObject({
      event: 'http_request',
      requestId: 'req-1',
      method: 'GET',
      route: '/incidents',
      handler: 'IncidentsController.list',
      statusCode: 200,
    });
    expect(lastEntry().durationMs).toBeGreaterThanOrEqual(0);
  });

  it('records the caller as ids only, never their email', async () => {
    const interceptor = new HttpLoggingInterceptor();
    const user: AuthenticatedUser = {
      id: 'u1',
      orgId: 'org-a',
      role: 'member',
      email: 'someone@example.com',
    };

    await firstValueFrom(
      interceptor.intercept(createContext({ user }), handler),
    );

    expect(lastEntry()).toMatchObject({ userId: 'u1', orgId: 'org-a' });
    expect(JSON.stringify(lastEntry())).not.toContain('someone@example.com');
  });

  it('omits the actor fields for an unauthenticated request', async () => {
    const interceptor = new HttpLoggingInterceptor();
    await firstValueFrom(interceptor.intercept(createContext(), handler));

    expect(lastEntry()).not.toHaveProperty('userId');
    expect(lastEntry()).not.toHaveProperty('orgId');
  });

  it('logs "unmatched" rather than a raw URL when no route pattern is known', async () => {
    const interceptor = new HttpLoggingInterceptor();
    await firstValueFrom(interceptor.intercept(createContext(), handler));
    expect(lastEntry()).toMatchObject({ route: 'unmatched' });
  });

  it('stays silent on failures — AllExceptionsFilter owns that line', async () => {
    const interceptor = new HttpLoggingInterceptor();
    const failing: CallHandler = {
      handle: () => throwError(() => new Error('boom')),
    };

    await expect(
      firstValueFrom(interceptor.intercept(createContext(), failing)),
    ).rejects.toThrow('boom');

    expect(logged).not.toHaveBeenCalled();
  });
});
