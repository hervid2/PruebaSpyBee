import { UnauthorizedException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import type { Role } from '@prisma/client';
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
          where: { id: string };
          data: Partial<UserRow>;
        }): Promise<Partial<UserRow>> =>
          Promise.resolve({ id: args.where.id, ...args.data }),
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

  it('counts a failed attempt against the account', async () => {
    const prisma = createPrismaMock();
    await withUser(prisma, { failedLoginAttempts: 3 });
    const { service } = createService(prisma);

    expect(await service.validateCredentials('a@b.com', 'wrong')).toBeNull();
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: { failedLoginAttempts: 4 },
    });
  });

  it('locks the account once the threshold is reached', async () => {
    const prisma = createPrismaMock();
    await withUser(prisma, {
      failedLoginAttempts: ACCOUNT_LOCKOUT_THRESHOLD - 1,
    });
    const { service } = createService(prisma);

    expect(await service.validateCredentials('a@b.com', 'wrong')).toBeNull();

    const data = prisma.user.update.mock.calls[0][0].data as {
      failedLoginAttempts: number;
      lockedUntil: Date;
    };
    // Counter reset with the lock, so the account comes back with a clean
    // slate rather than re-locking on the first failure after it expires.
    expect(data.failedLoginAttempts).toBe(0);
    expect(data.lockedUntil.getTime()).toBeGreaterThan(Date.now());
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
});
