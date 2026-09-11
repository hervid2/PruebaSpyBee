import { UnauthorizedException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { Prisma, type Role } from '@prisma/client';
import { AccountLockedException, AuthService } from './auth.service';
import { ACCOUNT_LOCKOUT_THRESHOLD } from './auth.constants';
import type { PrismaService } from '../../prisma/prisma.service';

interface UserRow {
  id: string;
  orgId: string;
  role: Role;
  email: string;
  passwordHash: string;
  failedLoginAttempts: number;
  lockedUntil: Date | null;
}

interface RefreshTokenRow {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
}

function createPrismaMock() {
  return {
    user: {
      findUnique: jest.fn((): Promise<UserRow | null> => Promise.resolve(null)),
      update: jest.fn(
        (args: {
          where: { id?: string; email?: string };
          data: Record<string, unknown>;
          select?: Record<string, boolean>;
        }): Promise<Partial<UserRow>> =>
          Promise.resolve({ ...args.where, ...args.data } as Partial<UserRow>),
      ),
    },
    refreshToken: {
      create: jest.fn(
        (args: {
          data: { userId: string; tokenHash: string; expiresAt: Date };
        }): Promise<RefreshTokenRow> =>
          Promise.resolve({ id: 'rt-new', revokedAt: null, ...args.data }),
      ),
      findUnique: jest.fn(
        (): Promise<(RefreshTokenRow & { user: UserRow }) | null> =>
          Promise.resolve(null),
      ),
      update: jest.fn(
        (args: {
          where: { id: string };
          data: Partial<RefreshTokenRow>;
        }): Promise<RefreshTokenRow> =>
          Promise.resolve({
            id: args.where.id,
            userId: 'u1',
            tokenHash: 'old-hash',
            expiresAt: new Date(),
            revokedAt: null,
            ...args.data,
          }),
      ),
      updateMany: jest.fn<
        Promise<{ count: number }>,
        [
          {
            where: { userId: string; tokenHash: string; revokedAt: null };
            data: Partial<RefreshTokenRow>;
          },
        ]
      >(),
    },
  };
}

/** What Prisma throws when an `update` matches no row. */
function recordNotFound(): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError(
    'No record was found for an update.',
    { code: 'P2025', clientVersion: 'test' },
  );
}

function createService(prisma: ReturnType<typeof createPrismaMock>) {
  const sign = jest.fn((): string => 'signed.jwt.token');
  const jwtService = { sign } as unknown as JwtService;
  const configService = {
    getOrThrow: jest.fn((): string => 'test-secret'),
    get: jest.fn(<T>(_key: string, fallback?: T): T | undefined => fallback),
  } as unknown as ConfigService;

  const service = new AuthService(
    prisma as unknown as PrismaService,
    jwtService,
    configService,
  );
  return { service, sign };
}

describe('AuthService', () => {
  describe('validateCredentials', () => {
    it('returns the authenticated user shape when the password matches', async () => {
      const prisma = createPrismaMock();
      const passwordHash = await bcrypt.hash('secret', 4);
      prisma.user.findUnique.mockResolvedValueOnce({
        id: 'u1',
        orgId: 'org1',
        role: 'member',
        email: 'a@b.com',
        passwordHash,
        failedLoginAttempts: 0,
        lockedUntil: null,
      });
      const { service } = createService(prisma);

      const result = await service.validateCredentials('a@b.com', 'secret');

      expect(result).toEqual({
        id: 'u1',
        orgId: 'org1',
        role: 'member',
        email: 'a@b.com',
      });
    });

    it('returns null for an unknown email', async () => {
      const prisma = createPrismaMock();
      prisma.user.update.mockRejectedValueOnce(recordNotFound());
      const { service } = createService(prisma);

      expect(
        await service.validateCredentials('nope@b.com', 'secret'),
      ).toBeNull();
    });

    it('returns null for a wrong password', async () => {
      const prisma = createPrismaMock();
      const passwordHash = await bcrypt.hash('secret', 4);
      prisma.user.findUnique.mockResolvedValueOnce({
        id: 'u1',
        orgId: 'org1',
        role: 'member',
        email: 'a@b.com',
        passwordHash,
        failedLoginAttempts: 0,
        lockedUntil: null,
      });
      prisma.user.update.mockResolvedValueOnce({ failedLoginAttempts: 1 });
      const { service } = createService(prisma);

      expect(await service.validateCredentials('a@b.com', 'wrong')).toBeNull();
    });
  });

  describe('login', () => {
    it('signs the access token with a numeric expiresIn even when the env var arrives as a string', async () => {
      // Regression test: `ConfigService.get` returns the raw dotenv string
      // ("900"), never a real number. jsonwebtoken treats a *string*
      // `expiresIn` as an `ms`-style duration (no unit = milliseconds), so
      // "900" used to expire tokens after 0.9s instead of 900s.
      const prisma = createPrismaMock();
      const sign = jest.fn<string, [unknown, { expiresIn: unknown }]>(
        () => 'signed.jwt.token',
      );
      const jwtService = { sign } as unknown as JwtService;
      const configService = {
        getOrThrow: jest.fn((): string => 'test-secret'),
        get: jest.fn((): string => '900'),
      } as unknown as ConfigService;
      const service = new AuthService(
        prisma as unknown as PrismaService,
        jwtService,
        configService,
      );

      await service.login({
        id: 'u1',
        orgId: 'org1',
        role: 'member',
        email: 'a@b.com',
      });

      const [, options] = sign.mock.calls[0];
      expect(options.expiresIn).toBe(900);
      expect(typeof options.expiresIn).toBe('number');
    });

    it('signs an access token and persists a hashed (not raw) refresh token', async () => {
      const prisma = createPrismaMock();
      const { service, sign } = createService(prisma);
      let persistedTokenHash: string | undefined;
      prisma.refreshToken.create.mockImplementationOnce(
        (args: {
          data: { userId: string; tokenHash: string; expiresAt: Date };
        }) => {
          persistedTokenHash = args.data.tokenHash;
          return Promise.resolve({
            id: 'rt-new',
            revokedAt: null,
            ...args.data,
          });
        },
      );

      const tokens = await service.login({
        id: 'u1',
        orgId: 'org1',
        role: 'member',
        email: 'a@b.com',
      });

      expect(sign).toHaveBeenCalled();
      expect(tokens.accessToken).toBe('signed.jwt.token');
      expect(tokens.refreshToken).toHaveLength(128);
      expect(prisma.refreshToken.create).toHaveBeenCalledTimes(1);
      expect(persistedTokenHash).toEqual(expect.any(String));
      expect(persistedTokenHash).not.toBe(tokens.refreshToken);
    });
  });

  describe('refresh', () => {
    it('rejects a token with no matching record', async () => {
      const prisma = createPrismaMock();
      const { service } = createService(prisma);

      await expect(service.refresh('unknown-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('rejects an already-revoked token', async () => {
      const prisma = createPrismaMock();
      prisma.refreshToken.findUnique.mockResolvedValueOnce({
        id: 'rt1',
        userId: 'u1',
        tokenHash: 'hash',
        revokedAt: new Date(),
        expiresAt: new Date(Date.now() + 10_000),
        user: {
          id: 'u1',
          orgId: 'org1',
          role: 'member',
          email: 'a@b.com',
          passwordHash: 'x',
          failedLoginAttempts: 0,
          lockedUntil: null,
        },
      });
      const { service } = createService(prisma);

      await expect(service.refresh('token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('rejects an expired token', async () => {
      const prisma = createPrismaMock();
      prisma.refreshToken.findUnique.mockResolvedValueOnce({
        id: 'rt1',
        userId: 'u1',
        tokenHash: 'hash',
        revokedAt: null,
        expiresAt: new Date(Date.now() - 10_000),
        user: {
          id: 'u1',
          orgId: 'org1',
          role: 'member',
          email: 'a@b.com',
          passwordHash: 'x',
          failedLoginAttempts: 0,
          lockedUntil: null,
        },
      });
      const { service } = createService(prisma);

      await expect(service.refresh('token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('rotates a valid token: revokes the old one and issues a new one', async () => {
      const prisma = createPrismaMock();
      prisma.refreshToken.findUnique.mockResolvedValueOnce({
        id: 'rt1',
        userId: 'u1',
        tokenHash: 'hash',
        revokedAt: null,
        expiresAt: new Date(Date.now() + 10_000),
        user: {
          id: 'u1',
          orgId: 'org1',
          role: 'member',
          email: 'a@b.com',
          passwordHash: 'x',
          failedLoginAttempts: 0,
          lockedUntil: null,
        },
      });
      let updateArgs:
        { where: { id: string }; data: Partial<RefreshTokenRow> } | undefined;
      prisma.refreshToken.update.mockImplementationOnce((args) => {
        updateArgs = args;
        return Promise.resolve({
          id: args.where.id,
          userId: 'u1',
          tokenHash: 'old-hash',
          expiresAt: new Date(),
          revokedAt: null,
          ...args.data,
        });
      });
      const { service } = createService(prisma);

      const tokens = await service.refresh('token');

      expect(updateArgs?.where).toEqual({ id: 'rt1' });
      expect(updateArgs?.data.revokedAt).toBeInstanceOf(Date);
      expect(prisma.refreshToken.create).toHaveBeenCalledTimes(1);
      expect(tokens.accessToken).toBe('signed.jwt.token');
    });
  });

  describe('logout', () => {
    it('revokes only the matching, still-active refresh token for that user', async () => {
      const prisma = createPrismaMock();
      let updateManyArgs:
        | {
            where: { userId: string; tokenHash: string; revokedAt: null };
            data: Partial<RefreshTokenRow>;
          }
        | undefined;
      prisma.refreshToken.updateMany.mockImplementationOnce((args) => {
        updateManyArgs = args;
        return Promise.resolve({ count: 1 });
      });
      const { service } = createService(prisma);

      await service.logout('u1', 'raw-token');

      expect(updateManyArgs?.where.userId).toBe('u1');
      expect(updateManyArgs?.where.revokedAt).toBeNull();
      expect(updateManyArgs?.data.revokedAt).toBeInstanceOf(Date);
    });
  });
});

/**
 * F9.5 — account-level brute-force protection. `@nestjs/throttler` counts per
 * IP inside a single Lambda instance's memory, so an attempt spread across
 * many addresses (or arriving while several instances are warm) never
 * converged on any one counter. This one lives on the `User` row.
 */
describe('AuthService account lockout', () => {
  const LOCKABLE_USER = {
    id: 'u1',
    orgId: 'org1',
    role: 'member' as Role,
    email: 'a@b.com',
  };

  /** The one write every failed login makes, whether or not the account exists. */
  const countFailure = (email: string) => ({
    where: { email },
    data: { failedLoginAttempts: { increment: 1 } },
    select: { failedLoginAttempts: true },
  });

  async function withUser(
    prisma: ReturnType<typeof createPrismaMock>,
    overrides: { failedLoginAttempts?: number; lockedUntil?: Date | null } = {},
  ): Promise<void> {
    prisma.user.findUnique.mockResolvedValueOnce({
      ...LOCKABLE_USER,
      passwordHash: await bcrypt.hash('secret', 4),
      failedLoginAttempts: overrides.failedLoginAttempts ?? 0,
      lockedUntil: overrides.lockedUntil ?? null,
    });
  }

  it('counts a failed attempt against the account, in the database', async () => {
    const prisma = createPrismaMock();
    await withUser(prisma, { failedLoginAttempts: 3 });
    prisma.user.update.mockResolvedValueOnce({ failedLoginAttempts: 4 });
    const { service } = createService(prisma);

    expect(await service.validateCredentials('a@b.com', 'wrong')).toBeNull();
    expect(prisma.user.update.mock.calls).toEqual([[countFailure('a@b.com')]]);
  });

  it('locks the account once the threshold is reached', async () => {
    const prisma = createPrismaMock();
    await withUser(prisma, {
      failedLoginAttempts: ACCOUNT_LOCKOUT_THRESHOLD - 1,
    });
    prisma.user.update.mockResolvedValueOnce({
      failedLoginAttempts: ACCOUNT_LOCKOUT_THRESHOLD,
    });
    const { service } = createService(prisma);

    expect(await service.validateCredentials('a@b.com', 'wrong')).toBeNull();

    expect(prisma.user.update).toHaveBeenCalledTimes(2);
    const lock = prisma.user.update.mock.calls[1][0];
    expect(lock.where).toEqual({ email: 'a@b.com' });
    const data = lock.data as {
      failedLoginAttempts: number;
      lockedUntil: Date;
    };
    // Counter reset with the lock, so the account comes back with a clean
    // slate rather than re-locking on the first failure after it expires.
    expect(data.failedLoginAttempts).toBe(0);
    expect(data.lockedUntil.getTime()).toBeGreaterThan(Date.now());
  });

  it('locks on the count the database returns, not the one read before the password check', async () => {
    // The row is read, bcrypt then takes ~200 ms, and only then is the
    // counter written. Concurrent failures land inside that gap, which is
    // precisely when a distributed attempt is doing its work: `previous + 1`
    // computed from the earlier read let them overwrite each other, so a
    // burst could be counted as a single failure.
    const prisma = createPrismaMock();
    await withUser(prisma, { failedLoginAttempts: 2 });
    prisma.user.update.mockResolvedValueOnce({
      failedLoginAttempts: ACCOUNT_LOCKOUT_THRESHOLD,
    });
    const { service } = createService(prisma);

    await service.validateCredentials('a@b.com', 'wrong');

    expect(prisma.user.update.mock.calls[1]?.[0].data).toMatchObject({
      failedLoginAttempts: 0,
      lockedUntil: expect.any(Date) as Date,
    });
  });

  it('refuses a locked account without checking the password at all', async () => {
    const prisma = createPrismaMock();
    await withUser(prisma, { lockedUntil: new Date(Date.now() + 60_000) });
    const { service } = createService(prisma);

    // 429 rather than a null return: the password may well be correct, and
    // the caller who sees this has already made enough failed attempts to
    // know the account exists.
    await expect(
      service.validateCredentials('a@b.com', 'secret'),
    ).rejects.toBeInstanceOf(AccountLockedException);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('lets a correct password through once the lock has expired, and clears it', async () => {
    const prisma = createPrismaMock();
    await withUser(prisma, {
      lockedUntil: new Date(Date.now() - 60_000),
      failedLoginAttempts: 0,
    });
    const { service } = createService(prisma);

    expect(await service.validateCredentials('a@b.com', 'secret')).toEqual(
      LOCKABLE_USER,
    );
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: { failedLoginAttempts: 0, lockedUntil: null },
    });
  });

  it('spends bcrypt time on an unknown email too', async () => {
    // Returning early for an unknown address makes response time answer
    // "does this account exist?" — the reconnaissance step that turns a
    // per-account lockout into a list of accounts worth locking.
    const prisma = createPrismaMock();
    prisma.user.update.mockRejectedValueOnce(recordNotFound());
    const { service } = createService(prisma);

    const started = Date.now();
    expect(
      await service.validateCredentials('nobody@b.com', 'secret'),
    ).toBeNull();
    // A bare `findUnique` miss returns in well under a millisecond; a real
    // bcrypt comparison cannot. The bound is loose on purpose — this asserts
    // the comparison happened, not how fast this machine is.
    expect(Date.now() - started).toBeGreaterThan(5);
  });

  it('sends an unknown email through the same counter write as a known one', async () => {
    // bcrypt already cost both paths the same, but the counter write used to
    // happen only for a real account, which put a database round trip back
    // on one side of the comparison — about 160 ms in production, enough to
    // answer "does this account exist?" on its own.
    const known = createPrismaMock();
    await withUser(known);
    known.user.update.mockResolvedValueOnce({ failedLoginAttempts: 1 });
    await createService(known).service.validateCredentials('a@b.com', 'wrong');

    const unknown = createPrismaMock();
    unknown.user.update.mockRejectedValueOnce(recordNotFound());
    expect(
      await createService(unknown).service.validateCredentials(
        'nobody@b.com',
        'wrong',
      ),
    ).toBeNull();

    expect(known.user.update.mock.calls).toEqual([[countFailure('a@b.com')]]);
    expect(unknown.user.update.mock.calls).toEqual([
      [countFailure('nobody@b.com')],
    ]);
  });

  it('does not mistake a database failure for an unknown email', async () => {
    // "No such row" is the one expected outcome of that write for an unknown
    // address. Swallowing anything else would turn an outage into a stream of
    // ordinary-looking 401s instead of the 5xx the F9.3 alarms watch for.
    const prisma = createPrismaMock();
    prisma.user.update.mockRejectedValueOnce(new Error('connection reset'));
    const { service } = createService(prisma);

    await expect(
      service.validateCredentials('nobody@b.com', 'wrong'),
    ).rejects.toThrow('connection reset');
  });
});
