import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import type { App } from 'supertest/types';
import { createTestApp } from './utils/test-app';
import type { FakePrismaService, FakeUser } from './utils/fake-prisma.service';
import {
  APP_THROTTLE_LIMIT,
  LOGIN_THROTTLE_LIMIT,
  REFRESH_TOKEN_COOKIE,
} from '../src/modules/auth/auth.constants';

describe('Auth hardening (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: FakePrismaService;
  let jwtService: JwtService;
  let member: FakeUser;

  beforeEach(async () => {
    const testApp = await createTestApp();
    app = testApp.app;
    prisma = testApp.prisma;
    jwtService = testApp.moduleRef.get(JwtService);

    member = await prisma.seedUser({
      email: 'member@acme.test',
      password: 'correct-horse',
      orgId: 'org-acme',
      role: 'member',
    });
  });

  afterEach(async () => {
    await app.close();
  });

  it('rejects an expired access token with 401, not a crash or a silent pass', async () => {
    const expiredToken = jwtService.sign(
      {
        sub: member.id,
        orgId: member.orgId,
        role: member.role,
        email: member.email,
      },
      { expiresIn: -10 },
    );

    await request(app.getHttpServer())
      .get('/users/me')
      .set('Authorization', `Bearer ${expiredToken}`)
      .expect(401);
  });

  it('rejects a token signed with the wrong secret', async () => {
    const forgedToken = jwtService.sign(
      {
        sub: member.id,
        orgId: member.orgId,
        role: member.role,
        email: member.email,
      },
      { secret: 'not-the-real-secret' },
    );

    await request(app.getHttpServer())
      .get('/users/me')
      .set('Authorization', `Bearer ${forgedToken}`)
      .expect(401);
  });

  it(`throttles /auth/login to ${LOGIN_THROTTLE_LIMIT} attempts per window and returns 429 past it`, async () => {
    const attempt = () =>
      request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: member.email, password: 'wrong-password' });

    for (let i = 0; i < LOGIN_THROTTLE_LIMIT; i++) {
      const res = await attempt();
      expect(res.status).toBe(401);
    }

    const throttled = await attempt();
    expect(throttled.status).toBe(429);
  });

  // F9.4 — refresh-token reuse detection. Rotation alone leaves a stolen
  // token useful: whoever spends it first gets a fresh session and the other
  // party just sees a 401, which is indistinguishable from an ordinary
  // expiry. Reuse is the one observable signal that two parties hold the same
  // token, so it has to end every session rather than just the request.
  describe('refresh token reuse', () => {
    async function loginAndGetRefreshCookie(): Promise<string> {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: member.email, password: 'correct-horse' })
        .expect(200);
      const cookie = res.headers['set-cookie'] as unknown as string[];
      return cookie.find((c) => c.startsWith(REFRESH_TOKEN_COOKIE))!;
    }

    it('revokes every session for the user when an already-rotated token is presented again', async () => {
      const stolen = await loginAndGetRefreshCookie();

      // The legitimate client rotates first; `stolen` is now spent.
      const rotated = await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Cookie', stolen)
        .expect(200);
      const rotatedCookie = (
        rotated.headers['set-cookie'] as unknown as string[]
      ).find((c) => c.startsWith(REFRESH_TOKEN_COOKIE))!;

      // The thief replays the copy they took.
      await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Cookie', stolen)
        .expect(401);

      // …which also costs the legitimate client its brand-new token: with no
      // way to tell the two apart, both are pushed back through a real login.
      await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Cookie', rotatedCookie)
        .expect(401);

      expect(prisma.refreshTokens.every((t) => t.revokedAt !== null)).toBe(
        true,
      );
    });

    it('leaves other sessions alone on a normal rotation', async () => {
      const phone = await loginAndGetRefreshCookie();
      const laptop = await loginAndGetRefreshCookie();

      await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Cookie', laptop)
        .expect(200);

      await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Cookie', phone)
        .expect(200);
    });
  });

  it(`throttles unauthenticated hits on a protected route after ${APP_THROTTLE_LIMIT} attempts, proving the global ThrottlerGuard runs before JwtAuthGuard`, async () => {
    const attempt = () =>
      request(app.getHttpServer())
        .get('/users/me')
        .set('Authorization', 'Bearer not-a-real-token');

    for (let i = 0; i < APP_THROTTLE_LIMIT; i++) {
      const res = await attempt();
      expect(res.status).toBe(401);
    }

    const throttled = await attempt();
    expect(throttled.status).toBe(429);
  });
});
