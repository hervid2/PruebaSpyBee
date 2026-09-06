import { INestApplication, Logger } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { createTestApp } from './utils/test-app';
import type { FakePrismaService, FakeUser } from './utils/fake-prisma.service';

interface AccessTokenBody {
  accessToken: string;
}

interface ErrorBody {
  statusCode: number;
  message: unknown;
  requestId?: string;
}

async function loginAs(
  app: INestApplication<App>,
  user: FakeUser,
  password: string,
): Promise<string> {
  const res = await request(app.getHttpServer())
    .post('/auth/login')
    .send({ email: user.email, password })
    .expect(200);
  return (res.body as AccessTokenBody).accessToken;
}

describe('Observability (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: FakePrismaService;
  let member: FakeUser;
  let errorLog: jest.SpyInstance;

  beforeEach(async () => {
    ({ app, prisma } = await createTestApp());
    member = await prisma.seedUser({
      email: 'member@org-a.test',
      password: 'password123',
      orgId: 'org-a',
      role: 'member',
      name: 'Org A Member',
    });
    // Silenced so the deliberate 500 below doesn't print a stack into an
    // otherwise green suite; the assertions read it back off the spy.
    errorLog = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => {});
  });

  afterEach(async () => {
    errorLog.mockRestore();
    await app.close();
  });

  it('answers every request with a correlation id header', async () => {
    const res = await request(app.getHttpServer()).get('/health').expect(200);
    expect(res.headers['x-request-id']).toEqual(expect.any(String));
  });

  it('exposes that header to the browser, not just to curl', async () => {
    const res = await request(app.getHttpServer())
      .get('/health')
      .set('Origin', 'http://localhost:3000')
      .expect(200);

    expect(res.headers['access-control-expose-headers']).toContain(
      'x-request-id',
    );
  });

  it('reuses a caller-supplied x-request-id instead of minting its own', async () => {
    const res = await request(app.getHttpServer())
      .get('/health')
      .set('x-request-id', 'trace-me-123')
      .expect(200);

    expect(res.headers['x-request-id']).toBe('trace-me-123');
  });

  it('keeps the validation detail of a 4xx and adds the id to correlate it', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'not-an-email', password: '' })
      .expect(400);

    const body = res.body as ErrorBody;
    expect(Array.isArray(body.message)).toBe(true);
    expect(body.requestId).toBe(res.headers['x-request-id']);
  });

  it('reduces an unexpected failure to a generic body, leaking no internals', async () => {
    const token = await loginAs(app, member, 'password123');
    jest.spyOn(prisma.project, 'findMany').mockImplementation(() => {
      throw new Error(
        'Invalid `prisma.project.findMany()` invocation: column "password_hash" does not exist',
      );
    });

    const res = await request(app.getHttpServer())
      .get('/projects')
      .set('Authorization', `Bearer ${token}`)
      .expect(500);

    expect(res.body).toEqual({
      statusCode: 500,
      message: 'Internal server error',
      requestId: res.headers['x-request-id'],
    });
    expect(JSON.stringify(res.body)).not.toContain('password_hash');
  });

  it('logs that failure once, with the route, the caller and a stack', async () => {
    const token = await loginAs(app, member, 'password123');
    jest.spyOn(prisma.project, 'findMany').mockImplementation(() => {
      throw new Error('connection pool exhausted');
    });

    const res = await request(app.getHttpServer())
      .get('/projects')
      .set('Authorization', `Bearer ${token}`)
      .expect(500);

    expect(errorLog).toHaveBeenCalledTimes(1);
    const [entry, trace] = errorLog.mock.calls[0] as [
      Record<string, unknown>,
      string,
    ];
    expect(entry).toMatchObject({
      event: 'http_request',
      requestId: res.headers['x-request-id'],
      method: 'GET',
      route: '/projects',
      statusCode: 500,
      orgId: 'org-a',
      error: 'Error: connection pool exhausted',
    });
    expect(trace).toContain('connection pool exhausted');
  });
});
