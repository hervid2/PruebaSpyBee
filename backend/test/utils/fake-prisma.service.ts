import * as bcrypt from 'bcrypt';
import { randomUUID } from 'node:crypto';
import {
  Prisma,
  type ApprovalStatus,
  type AuditAction,
  type IncidentPriority,
  type IncidentStatus,
  type InvitationStatus,
  type MediaStatus,
  type MediaType,
  type NotificationType,
  type Role,
} from '@prisma/client';

/**
 * Stands in for `PrismaService` in e2e tests. `F7.5` wires a real ephemeral
 * Postgres into CI; until then, this in-memory double implements just the
 * delegate methods the auth/RBAC modules actually call, matching Prisma's
 * shape closely enough for `overrideProvider(PrismaService)` to work as a
 * drop-in (`best-practices.md §Testing`: mocks are for real boundaries).
 */

export interface FakeUser {
  id: string;
  orgId: string;
  name: string;
  email: string;
  passwordHash: string;
  role: Role;
  avatarUrl: string | null;
  createdAt: Date;
  // Account lockout (F9.5) — see `AuthService.validateCredentials`.
  failedLoginAttempts: number;
  lockedUntil: Date | null;
}

interface FakeRefreshToken {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
  createdAt: Date;
}

export interface FakeProject {
  id: string;
  orgId: string;
  name: string;
  createdAt: Date;
}

export interface FakeIncidentType {
  id: string;
  key: string;
  name: string;
  nameEn: string;
}

export interface FakeTag {
  id: string;
  orgId: string;
  name: string;
  color: string;
}

export interface FakeIncident {
  id: string;
  sequenceId: string;
  orgId: string;
  projectId: string;
  typeId: string;
  title: string;
  description: string;
  priority: IncidentPriority;
  status: IncidentStatus;
  approval: ApprovalStatus;
  ownerId: string;
  deleted: boolean;
  lat: number | null;
  lng: number | null;
  locationDescription: string | null;
  dueDate: Date | null;
  closingDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
  assigneeIds: string[];
  observerIds: string[];
  tagIds: string[];
}

export interface FakeMedia {
  id: string;
  incidentId: string;
  name: string;
  type: MediaType;
  format: string;
  size: number;
  status: MediaStatus;
  url: string;
  createdAt: Date;
}

export interface FakeProjectPlan {
  id: string;
  projectId: string;
  name: string;
  type: MediaType;
  format: string;
  size: number;
  url: string;
  createdAt: Date;
}

export interface FakeAuditLog {
  id: string;
  orgId: string;
  incidentId: string;
  actorId: string;
  action: AuditAction;
  metadata: unknown;
  createdAt: Date;
}

export interface FakeNotification {
  id: string;
  orgId: string;
  recipientId: string;
  incidentId: string;
  type: NotificationType;
  readAt: Date | null;
  createdAt: Date;
}

export interface FakeOrganization {
  id: string;
  name: string;
  createdAt: Date;
}

export interface FakeInvitation {
  id: string;
  orgId: string;
  email: string;
  role: Role;
  tokenHash: string;
  invitedById: string;
  status: InvitationStatus;
  expiresAt: Date;
  createdAt: Date;
  acceptedAt: Date | null;
}

export interface FakeExportToken {
  id: string;
  userId: string;
  orgId: string;
  tokenHash: string;
  createdAt: Date;
}

interface FakeIncidentWhere {
  orgId?: string;
  deleted?: boolean;
  projectId?: string;
  id?: string;
  status?: { in: IncidentStatus[] };
  priority?: { in: IncidentPriority[] };
  type?: { key: { in: string[] } };
  createdAt?: { gte?: Date; lte?: Date };
}

export class FakePrismaService {
  readonly users: FakeUser[] = [];
  readonly refreshTokens: FakeRefreshToken[] = [];
  readonly projects: FakeProject[] = [];
  readonly incidentTypes: FakeIncidentType[] = [];
  readonly tags: FakeTag[] = [];
  readonly incidents: FakeIncident[] = [];
  readonly medias: FakeMedia[] = [];
  readonly projectPlans: FakeProjectPlan[] = [];
  readonly auditLogs: FakeAuditLog[] = [];
  readonly notifications: FakeNotification[] = [];
  readonly organizations: FakeOrganization[] = [];
  readonly invitations: FakeInvitation[] = [];
  readonly exportTokens: FakeExportToken[] = [];
  // Real (v4-shaped) uuids so `@IsUUID()`-validated DTO fields (e.g.
  // projectId/typeId/assigneeIds on incidents) accept seeded fixture ids.
  private nextId(): string {
    return randomUUID();
  }

  async seedProject(params: {
    orgId: string;
    name: string;
  }): Promise<FakeProject> {
    const project: FakeProject = {
      id: this.nextId(),
      orgId: params.orgId,
      name: params.name,
      createdAt: new Date(),
    };
    this.projects.push(project);
    return Promise.resolve(project);
  }

  async seedIncidentType(params: {
    key: string;
    name: string;
    nameEn: string;
  }): Promise<FakeIncidentType> {
    const type: FakeIncidentType = { id: this.nextId(), ...params };
    this.incidentTypes.push(type);
    return Promise.resolve(type);
  }

  async seedTag(params: {
    orgId: string;
    name: string;
    color: string;
  }): Promise<FakeTag> {
    const tag: FakeTag = { id: this.nextId(), ...params };
    this.tags.push(tag);
    return Promise.resolve(tag);
  }

  async seedIncident(
    params: Partial<Omit<FakeIncident, 'id'>> & {
      orgId: string;
      projectId: string;
      typeId: string;
      ownerId: string;
      title: string;
      priority: IncidentPriority;
    },
  ): Promise<FakeIncident> {
    const incident: FakeIncident = {
      id: this.nextId(),
      sequenceId:
        params.sequenceId ?? String(this.incidents.length + 1).padStart(4, '0'),
      orgId: params.orgId,
      projectId: params.projectId,
      typeId: params.typeId,
      title: params.title,
      description: params.description ?? 'Test incident description',
      priority: params.priority,
      status: params.status ?? 'open',
      approval: params.approval ?? 'pending',
      ownerId: params.ownerId,
      deleted: params.deleted ?? false,
      lat: params.lat ?? null,
      lng: params.lng ?? null,
      locationDescription: params.locationDescription ?? null,
      dueDate: params.dueDate ?? null,
      closingDate: params.closingDate ?? null,
      createdAt: params.createdAt ?? new Date(),
      updatedAt: params.updatedAt ?? new Date(),
      assigneeIds: params.assigneeIds ?? [],
      observerIds: params.observerIds ?? [],
      tagIds: params.tagIds ?? [],
    };
    this.incidents.push(incident);
    return Promise.resolve(incident);
  }

  async seedMedia(
    params: Partial<Omit<FakeMedia, 'id' | 'incidentId'>> & {
      incidentId: string;
    },
  ): Promise<FakeMedia> {
    const media: FakeMedia = {
      id: this.nextId(),
      incidentId: params.incidentId,
      name: params.name ?? 'test-file.jpg',
      type: params.type ?? 'image',
      format: params.format ?? 'jpg',
      size: params.size ?? 1024,
      status: params.status ?? 'uploaded',
      // Built from the incident's own id so the fixture is a URL the real
      // presign flow could actually have issued — `MediaService` now checks
      // that a stored URL sits under the incident's key prefix (F9.4), and a
      // fixture that ignored the prefix would quietly skip the S3 delete.
      url:
        params.url ??
        `https://fake-bucket.s3.fake-region.amazonaws.com/incidents/${params.incidentId}/test-file.jpg`,
      createdAt: params.createdAt ?? new Date(),
    };
    this.medias.push(media);
    return Promise.resolve(media);
  }

  async seedProjectPlan(
    params: Partial<Omit<FakeProjectPlan, 'id' | 'projectId'>> & {
      projectId: string;
    },
  ): Promise<FakeProjectPlan> {
    const plan: FakeProjectPlan = {
      id: this.nextId(),
      projectId: params.projectId,
      name: params.name ?? 'floor-1.pdf',
      type: params.type ?? 'document',
      format: params.format ?? 'pdf',
      size: params.size ?? 2048,
      url:
        params.url ??
        `https://fake-bucket.s3.fake-region.amazonaws.com/projects/${params.projectId}/plans/floor-1.pdf`,
      createdAt: params.createdAt ?? new Date(),
    };
    this.projectPlans.push(plan);
    return Promise.resolve(plan);
  }

  async seedUser(params: {
    email: string;
    password: string;
    orgId: string;
    role: Role;
    name?: string;
    failedLoginAttempts?: number;
    lockedUntil?: Date | null;
  }): Promise<FakeUser> {
    const user: FakeUser = {
      id: this.nextId(),
      orgId: params.orgId,
      name: params.name ?? 'Test User',
      email: params.email,
      // Low cost factor: this only needs to be correct, not production-strength.
      passwordHash: await bcrypt.hash(params.password, 4),
      role: params.role,
      avatarUrl: null,
      createdAt: new Date(),
      failedLoginAttempts: params.failedLoginAttempts ?? 0,
      lockedUntil: params.lockedUntil ?? null,
    };
    this.users.push(user);
    return user;
  }

  readonly user = {
    findUnique: ({
      where,
    }: {
      where: { email?: string; id?: string };
    }): Promise<FakeUser | null> => {
      const found = where.email
        ? this.users.find((u) => u.email === where.email)
        : this.users.find((u) => u.id === where.id);
      return Promise.resolve(found ?? null);
    },
    findMany: ({
      where,
    }: {
      where: { orgId: string };
    }): Promise<FakeUser[]> => {
      return Promise.resolve(this.users.filter((u) => u.orgId === where.orgId));
    },
    update: ({
      where,
      data,
    }: {
      // By `id` for profile and password changes; by `email` for the login
      // failure counter, which runs whether or not the account exists
      // (`AuthService.recordFailedLogin`).
      where: { id?: string; email?: string };
      data: Omit<Partial<FakeUser>, 'failedLoginAttempts'> & {
        failedLoginAttempts?: number | { increment: number };
      };
      // Accepted and ignored: returning the whole row is a superset of any
      // selection, which is all a caller reading a selected field can observe.
      select?: Record<string, boolean>;
    }): Promise<FakeUser> => {
      const user =
        where.email !== undefined
          ? this.users.find((u) => u.email === where.email)
          : this.users.find((u) => u.id === where.id);
      if (!user) {
        // Real Prisma's answer to an update that matched no row, which the
        // failure counter has to tell apart from a genuine database error.
        return Promise.reject(
          new Prisma.PrismaClientKnownRequestError(
            'No record was found for an update.',
            { code: 'P2025', clientVersion: 'fake' },
          ),
        );
      }
      const { failedLoginAttempts, ...rest } = data;
      Object.assign(user, rest);
      if (typeof failedLoginAttempts === 'number') {
        user.failedLoginAttempts = failedLoginAttempts;
      } else if (failedLoginAttempts) {
        user.failedLoginAttempts += failedLoginAttempts.increment;
      }
      return Promise.resolve(user);
    },
    create: ({
      data,
    }: {
      data: {
        orgId: string;
        name: string;
        email: string;
        passwordHash: string;
        role: Role;
      };
    }): Promise<FakeUser> => {
      const user: FakeUser = {
        id: this.nextId(),
        avatarUrl: null,
        createdAt: new Date(),
        failedLoginAttempts: 0,
        lockedUntil: null,
        ...data,
      };
      this.users.push(user);
      return Promise.resolve(user);
    },
  };

  readonly refreshToken = {
    create: ({
      data,
    }: {
      data: { userId: string; tokenHash: string; expiresAt: Date };
    }): Promise<FakeRefreshToken> => {
      const row: FakeRefreshToken = {
        id: this.nextId(),
        revokedAt: null,
        createdAt: new Date(),
        ...data,
      };
      this.refreshTokens.push(row);
      return Promise.resolve(row);
    },
    // `findUnique`, matching the service after `RefreshToken.tokenHash`
    // became `@unique` (F9.5).
    findUnique: ({
      where,
    }: {
      where: { tokenHash: string };
    }): Promise<(FakeRefreshToken & { user: FakeUser | null }) | null> => {
      const row = this.refreshTokens.find(
        (t) => t.tokenHash === where.tokenHash,
      );
      if (!row) return Promise.resolve(null);
      const user = this.users.find((u) => u.id === row.userId) ?? null;
      return Promise.resolve({ ...row, user });
    },
    update: ({
      where,
      data,
    }: {
      where: { id: string };
      data: Partial<FakeRefreshToken>;
    }): Promise<FakeRefreshToken | null> => {
      const row = this.refreshTokens.find((t) => t.id === where.id);
      if (row) Object.assign(row, data);
      return Promise.resolve(row ?? null);
    },
    updateMany: ({
      where,
      data,
    }: {
      // `tokenHash` is optional the way it is in Prisma's own filter: with it,
      // this revokes one session (logout); without it, all of them
      // (`AuthService.revokeAllForUser` — reuse detection and password
      // change, F9.4).
      where: { userId: string; tokenHash?: string; revokedAt: null };
      data: Partial<FakeRefreshToken>;
    }): Promise<{ count: number }> => {
      const matches = this.refreshTokens.filter(
        (t) =>
          t.userId === where.userId &&
          (where.tokenHash === undefined || t.tokenHash === where.tokenHash) &&
          t.revokedAt === null,
      );
      matches.forEach((row) => Object.assign(row, data));
      return Promise.resolve({ count: matches.length });
    },
  };

  readonly project = {
    findMany: ({
      where,
    }: {
      where: { orgId: string };
    }): Promise<FakeProject[]> => {
      return Promise.resolve(
        this.projects.filter((p) => p.orgId === where.orgId),
      );
    },
    findUnique: ({
      where,
    }: {
      where: { id: string };
    }): Promise<FakeProject | null> => {
      return Promise.resolve(
        this.projects.find((p) => p.id === where.id) ?? null,
      );
    },
    create: ({
      data,
    }: {
      data: { orgId: string; name: string };
    }): Promise<FakeProject> => {
      const project: FakeProject = {
        id: this.nextId(),
        createdAt: new Date(),
        ...data,
      };
      this.projects.push(project);
      return Promise.resolve(project);
    },
    update: ({
      where,
      data,
    }: {
      where: { id: string };
      data: Partial<FakeProject>;
    }): Promise<FakeProject | null> => {
      const project = this.projects.find((p) => p.id === where.id);
      if (project) Object.assign(project, data);
      return Promise.resolve(project ?? null);
    },
    delete: ({ where }: { where: { id: string } }): Promise<FakeProject> => {
      const index = this.projects.findIndex((p) => p.id === where.id);
      const [removed] = this.projects.splice(index, 1);
      return Promise.resolve(removed);
    },
  };

  readonly projectPlan = {
    create: ({
      data,
    }: {
      data: {
        projectId: string;
        name: string;
        type: MediaType;
        format: string;
        size: number;
        url: string;
      };
    }): Promise<FakeProjectPlan> => {
      const plan: FakeProjectPlan = {
        id: this.nextId(),
        createdAt: new Date(),
        ...data,
      };
      this.projectPlans.push(plan);
      return Promise.resolve(plan);
    },
    findMany: ({
      where,
      orderBy,
    }: {
      where?: { projectId?: string };
      orderBy?: { createdAt?: 'asc' | 'desc' };
    }): Promise<FakeProjectPlan[]> => {
      let results = this.projectPlans.filter(
        (p) => !where?.projectId || p.projectId === where.projectId,
      );
      if (orderBy?.createdAt) {
        const direction = orderBy.createdAt === 'asc' ? 1 : -1;
        results = [...results].sort(
          (a, b) => direction * (a.createdAt.getTime() - b.createdAt.getTime()),
        );
      }
      return Promise.resolve(results);
    },
    findUnique: ({
      where,
    }: {
      where: { id: string };
    }): Promise<(FakeProjectPlan & { project: FakeProject | null }) | null> => {
      const plan = this.projectPlans.find((p) => p.id === where.id);
      if (!plan) return Promise.resolve(null);
      const project =
        this.projects.find((p) => p.id === plan.projectId) ?? null;
      return Promise.resolve({ ...plan, project });
    },
    delete: ({
      where,
    }: {
      where: { id: string };
    }): Promise<FakeProjectPlan> => {
      const index = this.projectPlans.findIndex((p) => p.id === where.id);
      const [removed] = this.projectPlans.splice(index, 1);
      return Promise.resolve(removed);
    },
  };

  readonly incidentType = {
    findUnique: ({
      where,
    }: {
      where: { id: string };
    }): Promise<FakeIncidentType | null> => {
      return Promise.resolve(
        this.incidentTypes.find((t) => t.id === where.id) ?? null,
      );
    },
    findMany: (): Promise<FakeIncidentType[]> => {
      return Promise.resolve(
        [...this.incidentTypes].sort((a, b) => a.name.localeCompare(b.name)),
      );
    },
  };

  readonly tag = {
    findMany: ({ where }: { where: { orgId: string } }): Promise<FakeTag[]> => {
      return Promise.resolve(this.tags.filter((t) => t.orgId === where.orgId));
    },
    findUnique: ({
      where,
    }: {
      where: { id: string };
    }): Promise<FakeTag | null> => {
      return Promise.resolve(this.tags.find((t) => t.id === where.id) ?? null);
    },
    create: ({
      data,
    }: {
      data: { orgId: string; name: string; color: string };
    }): Promise<FakeTag> => {
      const tag: FakeTag = { id: this.nextId(), ...data };
      this.tags.push(tag);
      return Promise.resolve(tag);
    },
    update: ({
      where,
      data,
    }: {
      where: { id: string };
      data: Partial<FakeTag>;
    }): Promise<FakeTag | null> => {
      const tag = this.tags.find((t) => t.id === where.id);
      if (tag) Object.assign(tag, data);
      return Promise.resolve(tag ?? null);
    },
    delete: ({ where }: { where: { id: string } }): Promise<FakeTag> => {
      const index = this.tags.findIndex((t) => t.id === where.id);
      const [removed] = this.tags.splice(index, 1);
      return Promise.resolve(removed);
    },
  };

  async seedAuditLog(
    params: Partial<Omit<FakeAuditLog, 'id'>> & {
      orgId: string;
      incidentId: string;
      actorId: string;
      action: AuditAction;
    },
  ): Promise<FakeAuditLog> {
    const log: FakeAuditLog = {
      id: this.nextId(),
      orgId: params.orgId,
      incidentId: params.incidentId,
      actorId: params.actorId,
      action: params.action,
      metadata: params.metadata ?? {},
      createdAt: params.createdAt ?? new Date(),
    };
    this.auditLogs.push(log);
    return Promise.resolve(log);
  }

  private matchesAuditLogWhere(
    log: FakeAuditLog,
    where: {
      orgId?: string;
      actorId?: string;
      incident?: { projectId: string };
    } = {},
  ): boolean {
    if (where.orgId && log.orgId !== where.orgId) return false;
    if (where.actorId && log.actorId !== where.actorId) return false;
    if (where.incident?.projectId) {
      const incident = this.incidents.find((i) => i.id === log.incidentId);
      if (!incident || incident.projectId !== where.incident.projectId) {
        return false;
      }
    }
    return true;
  }

  readonly auditLog = {
    create: ({
      data,
    }: {
      data: {
        orgId: string;
        incidentId: string;
        actorId: string;
        action: AuditAction;
        metadata: unknown;
      };
    }): Promise<FakeAuditLog> => {
      const log: FakeAuditLog = {
        id: this.nextId(),
        createdAt: new Date(),
        ...data,
      };
      this.auditLogs.push(log);
      return Promise.resolve(log);
    },
    findMany: ({
      where,
      orderBy,
      skip,
      take,
    }: {
      where?: {
        orgId?: string;
        actorId?: string;
        incident?: { projectId: string };
      };
      orderBy?: { createdAt?: 'asc' | 'desc' };
      skip?: number;
      take?: number;
    }) => {
      let results = this.auditLogs.filter((l) =>
        this.matchesAuditLogWhere(l, where),
      );
      if (orderBy?.createdAt) {
        const direction = orderBy.createdAt === 'asc' ? 1 : -1;
        results = [...results].sort(
          (a, b) => direction * (a.createdAt.getTime() - b.createdAt.getTime()),
        );
      }
      if (typeof skip === 'number') results = results.slice(skip);
      if (typeof take === 'number') results = results.slice(0, take);
      return Promise.resolve(
        results.map((l) => ({
          ...l,
          actor: this.hydrateUserRef(l.actorId),
          incident: this.hydrateAuditIncidentRef(l.incidentId),
        })),
      );
    },
    count: ({
      where,
    }: {
      where?: {
        orgId?: string;
        actorId?: string;
        incident?: { projectId: string };
      };
    }): Promise<number> => {
      return Promise.resolve(
        this.auditLogs.filter((l) => this.matchesAuditLogWhere(l, where))
          .length,
      );
    },
  };

  async seedNotification(
    params: Partial<Omit<FakeNotification, 'id'>> & {
      orgId: string;
      recipientId: string;
      incidentId: string;
      type: NotificationType;
    },
  ): Promise<FakeNotification> {
    const notification: FakeNotification = {
      id: this.nextId(),
      orgId: params.orgId,
      recipientId: params.recipientId,
      incidentId: params.incidentId,
      type: params.type,
      readAt: params.readAt ?? null,
      createdAt: params.createdAt ?? new Date(),
    };
    this.notifications.push(notification);
    return Promise.resolve(notification);
  }

  readonly notification = {
    createMany: ({
      data,
    }: {
      data: {
        orgId: string;
        recipientId: string;
        incidentId: string;
        type: NotificationType;
      }[];
    }): Promise<{ count: number }> => {
      const now = new Date();
      for (const row of data) {
        this.notifications.push({
          id: this.nextId(),
          readAt: null,
          createdAt: now,
          ...row,
        });
      }
      return Promise.resolve({ count: data.length });
    },
    findUnique: ({
      where,
    }: {
      where: { id: string };
    }): Promise<FakeNotification | null> => {
      return Promise.resolve(
        this.notifications.find((n) => n.id === where.id) ?? null,
      );
    },
    findMany: ({
      where,
      orderBy,
      take,
    }: {
      where?: { recipientId?: string; createdAt?: { gt: Date } };
      orderBy?: { createdAt?: 'asc' | 'desc' };
      take?: number;
    }) => {
      let results = this.notifications.filter((n) => {
        if (where?.recipientId && n.recipientId !== where.recipientId) {
          return false;
        }
        if (where?.createdAt?.gt && n.createdAt <= where.createdAt.gt) {
          return false;
        }
        return true;
      });
      if (orderBy?.createdAt) {
        const direction = orderBy.createdAt === 'asc' ? 1 : -1;
        results = [...results].sort(
          (a, b) => direction * (a.createdAt.getTime() - b.createdAt.getTime()),
        );
      }
      if (typeof take === 'number') results = results.slice(0, take);
      return Promise.resolve(
        results.map((n) => ({
          ...n,
          incident: this.hydrateAuditIncidentRef(n.incidentId),
        })),
      );
    },
    update: ({
      where,
      data,
    }: {
      where: { id: string };
      data: Partial<FakeNotification>;
    }): Promise<FakeNotification | null> => {
      const notification = this.notifications.find((n) => n.id === where.id);
      if (notification) Object.assign(notification, data);
      return Promise.resolve(notification ?? null);
    },
  };

  async seedOrganization(params: {
    name: string;
    id?: string;
  }): Promise<FakeOrganization> {
    const organization: FakeOrganization = {
      id: params.id ?? this.nextId(),
      name: params.name,
      createdAt: new Date(),
    };
    this.organizations.push(organization);
    return Promise.resolve(organization);
  }

  async seedInvitation(
    params: Partial<Omit<FakeInvitation, 'id'>> & {
      orgId: string;
      email: string;
      tokenHash: string;
      invitedById: string;
      expiresAt: Date;
    },
  ): Promise<FakeInvitation> {
    const invitation: FakeInvitation = {
      id: this.nextId(),
      orgId: params.orgId,
      email: params.email,
      role: params.role ?? 'member',
      tokenHash: params.tokenHash,
      invitedById: params.invitedById,
      status: params.status ?? 'pending',
      expiresAt: params.expiresAt,
      createdAt: params.createdAt ?? new Date(),
      acceptedAt: params.acceptedAt ?? null,
    };
    this.invitations.push(invitation);
    return Promise.resolve(invitation);
  }

  readonly invitation = {
    create: ({
      data,
    }: {
      data: {
        orgId: string;
        email: string;
        role: Role;
        tokenHash: string;
        invitedById: string;
        expiresAt: Date;
      };
    }) => {
      const invitation: FakeInvitation = {
        id: this.nextId(),
        status: 'pending',
        createdAt: new Date(),
        acceptedAt: null,
        ...data,
      };
      this.invitations.push(invitation);
      return Promise.resolve({
        ...invitation,
        invitedBy: this.hydrateUserRef(invitation.invitedById),
      });
    },
    findMany: ({
      where,
      orderBy,
    }: {
      where?: { orgId?: string };
      orderBy?: { createdAt?: 'asc' | 'desc' };
    }) => {
      let results = this.invitations.filter(
        (i) => !where?.orgId || i.orgId === where.orgId,
      );
      if (orderBy?.createdAt) {
        const direction = orderBy.createdAt === 'asc' ? 1 : -1;
        results = [...results].sort(
          (a, b) => direction * (a.createdAt.getTime() - b.createdAt.getTime()),
        );
      }
      return Promise.resolve(
        results.map((i) => ({
          ...i,
          invitedBy: this.hydrateUserRef(i.invitedById),
        })),
      );
    },
    findUnique: ({ where }: { where: { id?: string; tokenHash?: string } }) => {
      const invitation = where.id
        ? this.invitations.find((i) => i.id === where.id)
        : this.invitations.find((i) => i.tokenHash === where.tokenHash);
      if (!invitation) return Promise.resolve(null);
      return Promise.resolve({
        ...invitation,
        invitedBy: this.hydrateUserRef(invitation.invitedById),
        organization: this.hydrateOrganizationRef(invitation.orgId),
      });
    },
    update: ({
      where,
      data,
    }: {
      where: { id: string };
      data: Partial<FakeInvitation>;
    }): Promise<FakeInvitation | null> => {
      const invitation = this.invitations.find((i) => i.id === where.id);
      if (invitation) Object.assign(invitation, data);
      return Promise.resolve(invitation ?? null);
    },
  };

  seedExportToken(
    params: Partial<Omit<FakeExportToken, 'id'>> & {
      userId: string;
      orgId: string;
      tokenHash: string;
    },
  ): Promise<FakeExportToken> {
    const token: FakeExportToken = {
      id: this.nextId(),
      userId: params.userId,
      orgId: params.orgId,
      tokenHash: params.tokenHash,
      createdAt: params.createdAt ?? new Date(),
    };
    this.exportTokens.push(token);
    return Promise.resolve(token);
  }

  readonly exportToken = {
    findUnique: ({
      where,
    }: {
      where: { userId?: string; tokenHash?: string };
    }): Promise<FakeExportToken | null> => {
      const found = where.userId
        ? this.exportTokens.find((t) => t.userId === where.userId)
        : this.exportTokens.find((t) => t.tokenHash === where.tokenHash);
      return Promise.resolve(found ?? null);
    },
    upsert: ({
      where,
      create,
      update,
    }: {
      where: { userId: string };
      create: { userId: string; orgId: string; tokenHash: string };
      update: { orgId: string; tokenHash: string };
    }): Promise<FakeExportToken> => {
      const existing = this.exportTokens.find((t) => t.userId === where.userId);
      if (existing) {
        Object.assign(existing, update);
        return Promise.resolve(existing);
      }
      const token: FakeExportToken = {
        id: this.nextId(),
        createdAt: new Date(),
        ...create,
      };
      this.exportTokens.push(token);
      return Promise.resolve(token);
    },
    delete: ({
      where,
    }: {
      where: { userId: string };
    }): Promise<FakeExportToken> => {
      const index = this.exportTokens.findIndex(
        (t) => t.userId === where.userId,
      );
      if (index === -1) {
        return Promise.reject(
          new Prisma.PrismaClientKnownRequestError(
            'An operation failed because it depends on one or more records that were required but not found.',
            { code: 'P2025', clientVersion: 'fake' },
          ),
        );
      }
      const [removed] = this.exportTokens.splice(index, 1);
      return Promise.resolve(removed);
    },
  };

  private hydrateOrganizationRef(orgId: string): { id: string; name: string } {
    const organization = this.organizations.find((o) => o.id === orgId);
    return organization
      ? { id: organization.id, name: organization.name }
      : { id: orgId, name: 'Unknown organization' };
  }

  private hydrateUserRef(userId: string): {
    id: string;
    name: string;
    email: string;
    avatarUrl: string | null;
  } {
    const user = this.users.find((u) => u.id === userId);
    return user
      ? {
          id: user.id,
          name: user.name,
          email: user.email,
          avatarUrl: user.avatarUrl,
        }
      : { id: userId, name: 'Unknown user', email: '', avatarUrl: null };
  }

  private hydrateAuditIncidentRef(incidentId: string): {
    id: string;
    sequenceId: string;
    title: string;
    project: { id: string; name: string };
  } {
    const incident = this.incidents.find((i) => i.id === incidentId);
    const project = incident
      ? this.projects.find((p) => p.id === incident.projectId)
      : undefined;
    return {
      id: incidentId,
      sequenceId: incident?.sequenceId ?? '',
      title: incident?.title ?? 'Unknown incident',
      project: project
        ? { id: project.id, name: project.name }
        : { id: incident?.projectId ?? '', name: 'Unknown project' },
    };
  }

  private hydrateIncident(incident: FakeIncident) {
    const project = this.projects.find((p) => p.id === incident.projectId);
    const type = this.incidentTypes.find((t) => t.id === incident.typeId);
    return {
      ...incident,
      project: project ?? {
        id: incident.projectId,
        orgId: incident.orgId,
        name: 'Unknown project',
        createdAt: new Date(),
      },
      type: type ?? {
        id: incident.typeId,
        key: 'unknown',
        name: 'Unknown',
        nameEn: 'Unknown',
      },
      owner: this.hydrateUserRef(incident.ownerId),
      assignees: incident.assigneeIds.map((userId) => ({
        userId,
        user: this.hydrateUserRef(userId),
      })),
      observers: incident.observerIds.map((userId) => ({
        userId,
        user: this.hydrateUserRef(userId),
      })),
      tags: incident.tagIds.map((tagId) => {
        const tag = this.tags.find((t) => t.id === tagId);
        return {
          tagId,
          tag: tag ?? {
            id: tagId,
            orgId: incident.orgId,
            name: 'Unknown',
            color: '#000000',
          },
        };
      }),
    };
  }

  private matchesIncidentWhere(
    incident: FakeIncident,
    where: FakeIncidentWhere = {},
  ): boolean {
    if (where.id && incident.id !== where.id) return false;
    if (where.orgId && incident.orgId !== where.orgId) return false;
    if (where.deleted !== undefined && incident.deleted !== where.deleted) {
      return false;
    }
    if (where.projectId && incident.projectId !== where.projectId) {
      return false;
    }
    if (where.status?.in && !where.status.in.includes(incident.status)) {
      return false;
    }
    if (where.priority?.in && !where.priority.in.includes(incident.priority)) {
      return false;
    }
    if (where.type?.key?.in) {
      const type = this.incidentTypes.find((t) => t.id === incident.typeId);
      if (!type || !where.type.key.in.includes(type.key)) return false;
    }
    if (where.createdAt?.gte && incident.createdAt < where.createdAt.gte) {
      return false;
    }
    if (where.createdAt?.lte && incident.createdAt > where.createdAt.lte) {
      return false;
    }
    return true;
  }

  readonly incident = {
    findMany: ({
      where,
      orderBy,
      skip,
      take,
    }: {
      where?: FakeIncidentWhere;
      orderBy?: { createdAt?: 'asc' | 'desc'; updatedAt?: 'asc' | 'desc' };
      skip?: number;
      take?: number;
    }) => {
      let results = this.incidents.filter((i) =>
        this.matchesIncidentWhere(i, where),
      );
      const sortField = orderBy?.createdAt
        ? 'createdAt'
        : orderBy?.updatedAt
          ? 'updatedAt'
          : undefined;
      if (sortField) {
        const direction = orderBy?.[sortField] === 'asc' ? 1 : -1;
        results = [...results].sort(
          (a, b) =>
            direction * (a[sortField].getTime() - b[sortField].getTime()),
        );
      }
      if (typeof skip === 'number') results = results.slice(skip);
      if (typeof take === 'number') results = results.slice(0, take);
      return Promise.resolve(results.map((i) => this.hydrateIncident(i)));
    },
    count: ({ where }: { where?: FakeIncidentWhere }): Promise<number> => {
      return Promise.resolve(
        this.incidents.filter((i) => this.matchesIncidentWhere(i, where))
          .length,
      );
    },
    findUnique: ({ where }: { where: { id: string } }) => {
      const incident = this.incidents.find((i) => i.id === where.id);
      return Promise.resolve(incident ? this.hydrateIncident(incident) : null);
    },
    create: ({
      data,
    }: {
      data: {
        sequenceId: string;
        orgId: string;
        projectId: string;
        typeId: string;
        title: string;
        description: string;
        priority: IncidentPriority;
        status: IncidentStatus;
        ownerId: string;
        lat: number | null;
        lng: number | null;
        locationDescription: string | null;
        dueDate: Date | null;
        assignees?: { create: { userId: string }[] };
        observers?: { create: { userId: string }[] };
        tags?: { create: { tagId: string }[] };
      };
    }) => {
      if (
        this.incidents.some(
          (i) => i.orgId === data.orgId && i.sequenceId === data.sequenceId,
        )
      ) {
        throw new Prisma.PrismaClientKnownRequestError(
          'Unique constraint failed on the fields: (`orgId`,`sequenceId`)',
          { code: 'P2002', clientVersion: 'fake' },
        );
      }
      const incident: FakeIncident = {
        id: this.nextId(),
        sequenceId: data.sequenceId,
        orgId: data.orgId,
        projectId: data.projectId,
        typeId: data.typeId,
        title: data.title,
        description: data.description,
        priority: data.priority,
        status: data.status,
        approval: 'pending',
        ownerId: data.ownerId,
        deleted: false,
        lat: data.lat,
        lng: data.lng,
        locationDescription: data.locationDescription,
        dueDate: data.dueDate,
        closingDate: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        assigneeIds: (data.assignees?.create ?? []).map((a) => a.userId),
        observerIds: (data.observers?.create ?? []).map((o) => o.userId),
        tagIds: (data.tags?.create ?? []).map((t) => t.tagId),
      };
      this.incidents.push(incident);
      return Promise.resolve(this.hydrateIncident(incident));
    },
    update: ({
      where,
      data,
    }: {
      where: { id: string };
      data: Partial<
        Omit<FakeIncident, 'assigneeIds' | 'observerIds' | 'tagIds' | 'id'>
      > & {
        assignees?: { deleteMany: object; create: { userId: string }[] };
        observers?: { deleteMany: object; create: { userId: string }[] };
        tags?: { deleteMany: object; create: { tagId: string }[] };
      };
    }) => {
      const incident = this.incidents.find((i) => i.id === where.id);
      if (!incident) throw new Error('Incident not found in fake store');
      const { assignees, observers, tags, ...scalars } = data;
      Object.assign(incident, scalars);
      if (assignees) {
        incident.assigneeIds = assignees.create.map((a) => a.userId);
      }
      if (observers) {
        incident.observerIds = observers.create.map((o) => o.userId);
      }
      if (tags) incident.tagIds = tags.create.map((t) => t.tagId);
      incident.updatedAt = new Date();
      return Promise.resolve(this.hydrateIncident(incident));
    },
  };

  private matchesMediaWhere(
    media: FakeMedia,
    where?: {
      incident?: { orgId?: string; deleted?: boolean };
      type?: { in: MediaType[] };
    },
  ): boolean {
    if (where?.incident) {
      const incident = this.incidents.find((i) => i.id === media.incidentId);
      if (!incident) return false;
      if (where.incident.orgId && incident.orgId !== where.incident.orgId) {
        return false;
      }
      if (
        where.incident.deleted !== undefined &&
        incident.deleted !== where.incident.deleted
      ) {
        return false;
      }
    }
    if (where?.type && !where.type.in.includes(media.type)) return false;
    return true;
  }

  readonly media = {
    create: ({
      data,
    }: {
      data: {
        incidentId: string;
        name: string;
        type: MediaType;
        format: string;
        size: number;
        status: MediaStatus;
        url: string;
      };
    }): Promise<FakeMedia> => {
      const media: FakeMedia = {
        id: this.nextId(),
        createdAt: new Date(),
        ...data,
      };
      this.medias.push(media);
      return Promise.resolve(media);
    },
    findUnique: ({ where }: { where: { id: string } }) => {
      const media = this.medias.find((m) => m.id === where.id);
      if (!media) return Promise.resolve(null);
      const incident = this.incidents.find((i) => i.id === media.incidentId);
      return Promise.resolve({ ...media, incident: incident ?? null });
    },
    findMany: ({
      where,
      orderBy,
      skip,
      take,
    }: {
      where?: {
        incident?: { orgId?: string; deleted?: boolean };
        type?: { in: MediaType[] };
      };
      orderBy?: { createdAt?: 'asc' | 'desc' };
      skip?: number;
      take?: number;
    }) => {
      let results = this.medias.filter((m) => this.matchesMediaWhere(m, where));
      if (orderBy?.createdAt) {
        const direction = orderBy.createdAt === 'asc' ? 1 : -1;
        results = [...results].sort(
          (a, b) => direction * (a.createdAt.getTime() - b.createdAt.getTime()),
        );
      }
      if (typeof skip === 'number') results = results.slice(skip);
      if (typeof take === 'number') results = results.slice(0, take);
      return Promise.resolve(
        results.map((m) => ({
          ...m,
          incident: this.hydrateAuditIncidentRef(m.incidentId),
        })),
      );
    },
    count: ({
      where,
    }: {
      where?: {
        incident?: { orgId?: string; deleted?: boolean };
        type?: { in: MediaType[] };
      };
    }): Promise<number> => {
      return Promise.resolve(
        this.medias.filter((m) => this.matchesMediaWhere(m, where)).length,
      );
    },
    delete: ({ where }: { where: { id: string } }): Promise<FakeMedia> => {
      const index = this.medias.findIndex((m) => m.id === where.id);
      const [removed] = this.medias.splice(index, 1);
      return Promise.resolve(removed);
    },
  };
}
