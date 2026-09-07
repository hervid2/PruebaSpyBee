import {
  ConflictException,
  GoneException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'node:crypto';
import type { User } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { hashToken } from '../../common/utils/hash-token.util';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { BCRYPT_SALT_ROUNDS } from '../../common/constants/security.constants';
import { CreateInvitationDto } from './dto/create-invitation.dto';
import {
  InvitationResponseDto,
  toInvitationResponseDto,
} from './dto/invitation-response.dto';
import { InvitationPreviewDto } from './dto/invitation-preview.dto';
import { AcceptInvitationDto } from './dto/accept-invitation.dto';
import { INVITATION_TTL_DAYS } from './invitations.constants';

@Injectable()
export class InvitationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  /** `POST /invitations` — admin+ only (`RolesGuard`). Generates a fresh link every call, no re-invite dedup. */
  async create(
    dto: CreateInvitationDto,
    user: AuthenticatedUser,
  ): Promise<InvitationResponseDto> {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existingUser) {
      throw new ConflictException('A user with this email already exists');
    }

    const rawToken = randomBytes(32).toString('hex');
    const expiresAt = new Date(
      Date.now() + INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000,
    );

    const invitation = await this.prisma.invitation.create({
      data: {
        orgId: user.orgId,
        email: dto.email,
        role: dto.role ?? 'member',
        tokenHash: hashToken(rawToken),
        invitedById: user.id,
        expiresAt,
      },
      include: { invitedBy: true },
    });

    const frontendOrigin = this.configService.get<string>(
      'FRONTEND_ORIGIN',
      'http://localhost:3000',
    );
    const inviteUrl = `${frontendOrigin}/invitar/${rawToken}`;

    return toInvitationResponseDto(invitation, inviteUrl);
  }

  /** `GET /invitations` — the organization's invitations, most recent first. */
  async findAll(user: AuthenticatedUser): Promise<InvitationResponseDto[]> {
    const invitations = await this.prisma.invitation.findMany({
      where: { orgId: user.orgId },
      include: { invitedBy: true },
      orderBy: { createdAt: 'desc' },
    });
    return invitations.map((invitation) => toInvitationResponseDto(invitation));
  }

  /** `DELETE /invitations/:id` — 404 unknown/other-org, 409 already accepted, idempotent on an already-revoked one. */
  async revoke(id: string, user: AuthenticatedUser): Promise<void> {
    const invitation = await this.prisma.invitation.findUnique({
      where: { id },
    });
    if (
      !invitation ||
      (user.role !== 'superadmin' && invitation.orgId !== user.orgId)
    ) {
      throw new NotFoundException();
    }
    if (invitation.status === 'accepted') {
      throw new ConflictException('This invitation has already been accepted');
    }
    if (invitation.status !== 'revoked') {
      await this.prisma.invitation.update({
        where: { id },
        data: { status: 'revoked' },
      });
    }
  }

  /** `GET /invitations/token/:token` — public, backs the `/invitar/:token` accept page. */
  async preview(rawToken: string): Promise<InvitationPreviewDto> {
    const invitation = await this.findValidPendingInvitation(rawToken);
    return {
      email: invitation.email,
      role: invitation.role,
      orgName: invitation.organization.name,
      expiresAt: invitation.expiresAt,
    };
  }

  /**
   * `POST /invitations/token/:token/accept` — creates the real user account
   * and consumes the invitation. Returns the new user so the controller can
   * log them in immediately, mirroring `AuthService.login`'s session issuance.
   */
  async accept(rawToken: string, dto: AcceptInvitationDto): Promise<User> {
    const invitation = await this.findValidPendingInvitation(rawToken);

    const existingUser = await this.prisma.user.findUnique({
      where: { email: invitation.email },
    });
    if (existingUser) {
      throw new ConflictException('A user with this email already exists');
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_SALT_ROUNDS);
    const user = await this.prisma.user.create({
      data: {
        orgId: invitation.orgId,
        name: dto.name,
        email: invitation.email,
        passwordHash,
        role: invitation.role,
      },
    });

    await this.prisma.invitation.update({
      where: { id: invitation.id },
      data: { status: 'accepted', acceptedAt: new Date() },
    });

    return user;
  }

  private async findValidPendingInvitation(rawToken: string) {
    const invitation = await this.prisma.invitation.findUnique({
      where: { tokenHash: hashToken(rawToken) },
      include: { organization: true },
    });
    if (!invitation) {
      throw new NotFoundException();
    }
    if (invitation.status !== 'pending' || invitation.expiresAt < new Date()) {
      throw new GoneException('This invitation is no longer valid');
    }
    return invitation;
  }
}
