import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { hashToken } from '../../common/utils/hash-token.util';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import type { JwtAccessPayload } from './interfaces/jwt-payload.interface';
import {
  DEFAULT_ACCESS_TOKEN_TTL_SECONDS,
  DEFAULT_REFRESH_TOKEN_TTL_DAYS,
} from './auth.constants';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

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
    if (!user) return null;

    const matches = await bcrypt.compare(password, user.passwordHash);
    if (!matches) return null;

    return {
      id: user.id,
      orgId: user.orgId,
      role: user.role,
      email: user.email,
    };
  }

  async login(user: AuthenticatedUser): Promise<AuthTokens> {
    const accessToken = this.signAccessToken(user);
    const refreshToken = await this.issueRefreshToken(user.id);
    return { accessToken, refreshToken };
  }

  /** Rotates the refresh token: the presented one is revoked, a new one is issued. */
  async refresh(rawToken: string): Promise<AuthTokens> {
    const tokenHash = hashToken(rawToken);
    const stored = await this.prisma.refreshToken.findFirst({
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
