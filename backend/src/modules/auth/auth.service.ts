import {
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { hashToken } from '../../common/utils/hash-token.util';
import { BCRYPT_SALT_ROUNDS } from '../../common/constants/security.constants';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import type { JwtAccessPayload } from './interfaces/jwt-payload.interface';
import {
  ACCOUNT_LOCKOUT_THRESHOLD,
  ACCOUNT_LOCKOUT_WINDOW_MS,
  DEFAULT_ACCESS_TOKEN_TTL_SECONDS,
  DEFAULT_REFRESH_TOKEN_TTL_DAYS,
} from './auth.constants';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

/**
 * 429, not 401 (F9.5). A locked account is not "wrong password" — the
 * password may well be right — and telling the real user that only their
 * timing is wrong is the difference between a useful message and a
 * mystery. It does confirm the address exists, but only to a caller who has
 * already made ten failed attempts against it and therefore already knows.
 */
export class AccountLockedException extends HttpException {
  constructor() {
    super(
      'Too many failed sign-in attempts. Try again in a few minutes.',
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}

/**
 * A real bcrypt hash of a value nothing can log in with, used only to spend
 * the same time on an unknown email as on a known one. Generated once at
 * module load; `bcrypt.compare` against it always fails.
 */
const DUMMY_PASSWORD_HASH = bcrypt.hashSync(
  randomBytes(32).toString('hex'),
  BCRYPT_SALT_ROUNDS,
);

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async validateCredentials(
    email: string,
    password: string,
  ): Promise<AuthenticatedUser | null> {
    const user = await this.prisma.user.findUnique({ where: { email } });

    if (!user) {
      // Compared against a throwaway hash rather than returning immediately,
      // so an unknown address costs the same ~200 ms as a known one. Without
      // this, response time alone answers "does this account exist?" — which
      // is the reconnaissance step before the attempt the lockout below is
      // there to stop.
      await bcrypt.compare(password, DUMMY_PASSWORD_HASH);
      return null;
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new AccountLockedException();
    }

    const matches = await bcrypt.compare(password, user.passwordHash);
    if (!matches) {
      await this.recordFailedLogin(user.id, user.failedLoginAttempts);
      return null;
    }

    // Any successful login clears the account, including one that lands after
    // a lock has expired on its own.
    if (user.failedLoginAttempts > 0 || user.lockedUntil) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { failedLoginAttempts: 0, lockedUntil: null },
      });
    }

    return {
      id: user.id,
      orgId: user.orgId,
      role: user.role,
      email: user.email,
    };
  }

  /**
   * Counts one failed attempt against the account and locks it at the
   * threshold (F9.5). The counter resets when the lock is set rather than
   * when it expires, so the account comes back with a clean slate and the
   * next `ACCOUNT_LOCKOUT_THRESHOLD` failures are needed to lock it again.
   */
  private async recordFailedLogin(
    userId: string,
    previousAttempts: number,
  ): Promise<void> {
    const attempts = previousAttempts + 1;
    const locked = attempts >= ACCOUNT_LOCKOUT_THRESHOLD;
    await this.prisma.user.update({
      where: { id: userId },
      data: locked
        ? {
            failedLoginAttempts: 0,
            lockedUntil: new Date(Date.now() + ACCOUNT_LOCKOUT_WINDOW_MS),
          }
        : { failedLoginAttempts: attempts },
    });
  }

  async login(user: AuthenticatedUser): Promise<AuthTokens> {
    const accessToken = this.signAccessToken(user);
    const refreshToken = await this.issueRefreshToken(user.id);
    return { accessToken, refreshToken };
  }

  /** Rotates the refresh token: the presented one is revoked, a new one is issued. */
  async refresh(rawToken: string): Promise<AuthTokens> {
    const tokenHash = hashToken(rawToken);
    // `findUnique`, now that `RefreshToken.tokenHash` is `@unique` (F9.5).
    // The `findFirst` this replaces would have picked an arbitrary row had a
    // hash ever appeared twice, which is the one thing the reuse detection
    // below cannot tolerate.
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!stored || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // Reuse detection (F9.4). Rotation means a token is presented exactly
    // once; seeing an already-revoked one again is not a normal outcome, it
    // means two parties hold the same token — the legitimate client and
    // whoever copied it. There is no way to tell which of the two is calling,
    // so the whole family goes: every session for this user is revoked and
    // both are forced back through a real login, which the thief cannot pass.
    if (stored.revokedAt) {
      await this.revokeAllForUser(stored.userId);
      throw new UnauthorizedException('Invalid refresh token');
    }

    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    const user: AuthenticatedUser = {
      id: stored.user.id,
      orgId: stored.user.orgId,
      role: stored.user.role,
      email: stored.user.email,
    };
    const accessToken = this.signAccessToken(user);
    const refreshToken = await this.issueRefreshToken(user.id);
    return { accessToken, refreshToken };
  }

  async logout(userId: string, rawToken: string): Promise<void> {
    const tokenHash = hashToken(rawToken);
    await this.prisma.refreshToken.updateMany({
      where: { userId, tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /**
   * Ends every session this user has. Called on refresh-token reuse (above)
   * and on a password change (`UsersService.changePassword`) — changing a
   * password is how someone responds to a suspected compromise, so leaving
   * the sessions it was meant to cut off alive for the remaining days of
   * their refresh-token TTL would defeat the point.
   *
   * Access tokens already issued are not revocable (they are stateless JWTs)
   * and stay valid until they expire — 15 minutes by default, which is the
   * trade-off that short TTL exists to bound.
   */
  async revokeAllForUser(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private signAccessToken(user: AuthenticatedUser): string {
    const payload: JwtAccessPayload = {
      sub: user.id,
      orgId: user.orgId,
      role: user.role,
      email: user.email,
    };
    return this.jwtService.sign(payload, {
      secret: this.configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
      // See the matching comment in auth.module.ts: the env value arrives as
      // a string, and jsonwebtoken treats a string `expiresIn` as an `ms`-style
      // duration (no unit = milliseconds) rather than a count of seconds.
      expiresIn: Number(
        this.configService.get<string>('JWT_ACCESS_EXPIRES_IN_SECONDS') ??
          DEFAULT_ACCESS_TOKEN_TTL_SECONDS,
      ),
    });
  }

  private async issueRefreshToken(userId: string): Promise<string> {
    const token = randomBytes(64).toString('hex');
    const ttlDays = Number(
      this.configService.get<string>('JWT_REFRESH_EXPIRES_IN_DAYS') ??
        DEFAULT_REFRESH_TOKEN_TTL_DAYS,
    );
    const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000);

    await this.prisma.refreshToken.create({
      data: { userId, tokenHash: hashToken(token), expiresAt },
    });

    return token;
  }
}
