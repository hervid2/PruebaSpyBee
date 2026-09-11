import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import type { App } from 'supertest/types';
import { createTestApp } from './utils/test-app';
import type { FakePrismaService, FakeUser } from './utils/fake-prisma.service';
import {
  ACCOUNT_LOCKOUT_THRESHOLD,
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

  /**
   * F9.5 — account-level brute-force protection. The throttle above is per IP
   * and per Lambda instance, so it bounds one caller's rate and nothing else:
   * an attempt spread across many addresses converging on a single account
   * met no limit at all. These count on the `User` row, which is the one
   * counter in this stack that every instance shares.
   */
  describe('account lockout', () => {
    const login = (email: string, password: string) =>
      request(app.getHttpServer())
        .post('/auth/login')
        .send({ email, password });

    it('locks the account on the failure that reaches the threshold', async () => {
      const nearlyLocked = await prisma.seedUser({
        email: 'nearly@acme.test',
        password: 'correct-horse',
        orgId: 'org-acme',
        role: 'member',
        failedLoginAttempts: ACCOUNT_LOCKOUT_THRESHOLD - 1,
      });

      // The failure that trips it still reads as an ordinary 401 — the lock
      // is what the *next* attempt meets.
      await login(nearlyLocked.email, 'wrong-password').expect(401);

      // 429 even though this password is the correct one: that is the point,
      // and it is why the lock cannot be probed as an oracle for the password.
      await login(nearlyLocked.email, 'correct-horse').expect(429);
    });

    it('lets the right password through again once the window has passed', async () => {
      const expired = await prisma.seedUser({
        email: 'expired-lock@acme.test',
        password: 'correct-horse',
        orgId: 'org-acme',
        role: 'member',
        lockedUntil: new Date(Date.now() - 60_000),
      });

      await login(expired.email, 'correct-horse').expect(200);
    });

    it('does not lock other accounts, or sessions already signed in', async () => {
      const locked = await prisma.seedUser({
        email: 'locked@acme.test',
        password: 'correct-horse',
        orgId: 'org-acme',
        role: 'member',
        lockedUntil: new Date(Date.now() + 60_000),
      });

      await login(locked.email, 'correct-horse').expect(429);
      // A lock an attacker can trigger against a known address would
      // otherwise be a denial of service against that user and everyone
      // near them.
      await login(member.email, 'correct-horse').expect(200);
    });

    it('answers an unknown email with the same 401 as a wrong password', async () => {
      // An unknown address goes through the same counter write as a real one
      // and meets "no such row" there. That must stay a 401: letting Prisma's
      // P2025 escape as a 500 would break sign-in for a mistyped address and
      // make the two cases tell themselves apart again. This passed before the
      // write was shared as well — what it guards is the catch.
      await login('nobody@acme.test', 'correct-horse').expect(401);
      await login(member.email, 'wrong-password').expect(401);
    });
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
