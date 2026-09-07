import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import {
  DEFAULT_PAGE_SIZE,
  PaginationQueryDto,
} from '../../common/dto/pagination-query.dto';
import {
  PaginatedResponseDto,
  toPaginatedResponse,
} from '../../common/dto/paginated-response.dto';
import { CreateIncidentDto } from './dto/create-incident.dto';
import { UpdateIncidentDto } from './dto/update-incident.dto';
import { UpdateIncidentStatusDto } from './dto/update-incident-status.dto';
import { UpdateIncidentApprovalDto } from './dto/update-incident-approval.dto';
import { ListIncidentsQueryDto } from './dto/list-incidents-query.dto';
import {
  IncidentResponseDto,
  toIncidentResponseDto,
} from './dto/incident-response.dto';
import {
  ALLOWED_STATUS_TRANSITIONS,
  INCIDENT_SEQUENCE_ID_LENGTH,
} from './incidents.constants';
import { toCsv, CsvColumn } from '../../common/utils/csv.util';

const INCIDENT_INCLUDE = {
  project: true,
  type: true,
  owner: true,
  assignees: { include: { user: true } },
  observers: { include: { user: true } },
  tags: { include: { tag: true } },
} as const;

// Each retry re-reads the high-water mark, so a loser in a concurrent create
// converges after one round; the extra headroom is for a burst of several at
// once. Exhausting them is a 409, not the raw P2002 (see `create`).
const MAX_SEQUENCE_ID_ATTEMPTS = 5;

// Caps `GET /incidents/export.csv` — well above this project's ~200-incident
// mock scale, just a guard against an unbounded response body.
const INCIDENT_EXPORT_MAX_ROWS = 5000;

const INCIDENT_CSV_COLUMNS: CsvColumn<IncidentResponseDto>[] = [
  { header: 'id', value: (i) => i.sequenceId },
  { header: 'title', value: (i) => i.title },
  { header: 'type', value: (i) => i.type.name },
  { header: 'status', value: (i) => i.status },
  { header: 'priority', value: (i) => i.priority },
  { header: 'approval', value: (i) => i.approval },
  { header: 'project', value: (i) => i.project.name },
  { header: 'owner', value: (i) => i.owner.name },
  { header: 'ownerEmail', value: (i) => i.owner.email },
  {
    header: 'assignees',
    value: (i) => i.assignees.map((a) => a.name).join('; '),
  },
  { header: 'tags', value: (i) => i.tags.map((t) => t.name).join('; ') },
  { header: 'createdAt', value: (i) => i.createdAt.toISOString() },
  { header: 'dueDate', value: (i) => i.dueDate?.toISOString() ?? '' },
  { header: 'closingDate', value: (i) => i.closingDate?.toISOString() ?? '' },
  { header: 'locationDescription', value: (i) => i.locationDescription ?? '' },
  { header: 'lat', value: (i) => i.coordinates?.lat ?? '' },
  { header: 'lng', value: (i) => i.coordinates?.lng ?? '' },
];

interface ScopedIncident {
  id: string;
  orgId: string;
  ownerId: string;
  status: string;
  approval: string;
  deleted: boolean;
  assignees: { userId: string }[];
}

@Injectable()
export class IncidentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  /** Shared by `findAll` and `exportCsv` — every filter dimension `GET /incidents` supports. */
  private buildWhere(
    query: Pick<
      ListIncidentsQueryDto,
      'status' | 'priority' | 'typeKey' | 'projectId' | 'dateFrom' | 'dateTo'
    >,
    orgId: string,
  ): Prisma.IncidentWhereInput {
    const where: Prisma.IncidentWhereInput = { orgId, deleted: false };
    if (query.status?.length) where.status = { in: query.status };
    if (query.priority?.length) where.priority = { in: query.priority };
    if (query.typeKey?.length) where.type = { key: { in: query.typeKey } };
    if (query.projectId) where.projectId = query.projectId;
    if (query.dateFrom || query.dateTo) {
      where.createdAt = {
        ...(query.dateFrom ? { gte: new Date(query.dateFrom) } : {}),
        ...(query.dateTo ? { lte: new Date(query.dateTo) } : {}),
      };
    }
    return where;
  }

  async findAll(
    query: ListIncidentsQueryDto,
    user: AuthenticatedUser,
  ): Promise<PaginatedResponseDto<IncidentResponseDto>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? DEFAULT_PAGE_SIZE;
    const where = this.buildWhere(query, user.orgId);

    const [items, total] = await Promise.all([
      this.prisma.incident.findMany({
        where,
        include: INCIDENT_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.incident.count({ where }),
    ]);

    return toPaginatedResponse(
      items.map(toIncidentResponseDto),
      total,
      page,
      pageSize,
    );
  }

  /**
   * `GET /incidents/export.csv` — same filter dimensions as `findAll`, no
   * pagination (a full CSV export of everything matching, capped so a
   * runaway org doesn't produce an unbounded response body).
   */
  async exportCsv(
    query: Omit<ListIncidentsQueryDto, 'page' | 'pageSize'>,
    user: AuthenticatedUser,
  ): Promise<string> {
    const where = this.buildWhere(query, user.orgId);
    const items = await this.prisma.incident.findMany({
      where,
      include: INCIDENT_INCLUDE,
      orderBy: { createdAt: 'desc' },
      take: INCIDENT_EXPORT_MAX_ROWS,
    });
    return toCsv(items.map(toIncidentResponseDto), INCIDENT_CSV_COLUMNS);
  }

  async findOne(
    id: string,
    user: AuthenticatedUser,
  ): Promise<IncidentResponseDto> {
    const incident = await this.prisma.incident.findUnique({
      where: { id },
      include: INCIDENT_INCLUDE,
    });
    if (!incident || incident.deleted) throw new NotFoundException();
    if (user.role !== 'superadmin' && incident.orgId !== user.orgId) {
      throw new NotFoundException();
    }
    return toIncidentResponseDto(incident);
  }

  async findTrash(
    query: PaginationQueryDto,
    user: AuthenticatedUser,
  ): Promise<PaginatedResponseDto<IncidentResponseDto>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? DEFAULT_PAGE_SIZE;
    const where: Prisma.IncidentWhereInput = {
      orgId: user.orgId,
      deleted: true,
    };

    const [items, total] = await Promise.all([
      this.prisma.incident.findMany({
        where,
        include: INCIDENT_INCLUDE,
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.incident.count({ where }),
    ]);

    return toPaginatedResponse(
      items.map(toIncidentResponseDto),
      total,
      page,
      pageSize,
    );
  }

  async restore(
    id: string,
    user: AuthenticatedUser,
  ): Promise<IncidentResponseDto> {
    const incident = await this.prisma.incident.findUnique({ where: { id } });
    if (!incident) throw new NotFoundException();
    if (user.role !== 'superadmin' && incident.orgId !== user.orgId) {
      throw new NotFoundException();
    }
    // "Not in trash" reuses 404, same not-found convention as everywhere else.
    if (!incident.deleted) throw new NotFoundException();

    const restored = await this.prisma.incident.update({
      where: { id },
      data: { deleted: false },
      include: INCIDENT_INCLUDE,
    });
    return toIncidentResponseDto(restored);
  }

  async create(
    dto: CreateIncidentDto,
    user: AuthenticatedUser,
  ): Promise<IncidentResponseDto> {
    await this.assertProjectInOrg(dto.projectId, user.orgId);
    await this.assertTypeExists(dto.typeId);
    await this.assertUsersInOrg(dto.assigneeIds ?? [], user.orgId);
    await this.assertUsersInOrg(dto.observerIds ?? [], user.orgId);
    await this.assertTagsInOrg(dto.tagIds ?? [], user.orgId);

    for (let attempt = 1; attempt <= MAX_SEQUENCE_ID_ATTEMPTS; attempt++) {
      const sequenceId = await this.nextSequenceId(user.orgId);
      try {
        const created = await this.prisma.incident.create({
          data: {
            sequenceId,
            orgId: user.orgId,
            projectId: dto.projectId,
            typeId: dto.typeId,
            title: dto.title,
            description: dto.description,
            priority: dto.priority,
            status: 'open',
            ownerId: user.id,
            lat: dto.coordinates?.lat ?? null,
            lng: dto.coordinates?.lng ?? null,
            locationDescription: dto.locationDescription ?? null,
            dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
            assignees: {
              create: (dto.assigneeIds ?? []).map((userId) => ({ userId })),
            },
            observers: {
              create: (dto.observerIds ?? []).map((userId) => ({ userId })),
            },
            tags: {
              create: (dto.tagIds ?? []).map((tagId) => ({ tagId })),
            },
          },
          include: INCIDENT_INCLUDE,
        });
        await this.notifications.notify(
          user.orgId,
          created.id,
          dto.assigneeIds ?? [],
          user.id,
          'assignment',
        );
        return toIncidentResponseDto(created);
      } catch (error) {
        const isSequenceCollision =
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002';
        if (!isSequenceCollision) throw error;
        if (attempt === MAX_SEQUENCE_ID_ATTEMPTS) {
          // A collision that outlives every retry is a conflict the caller
          // can act on by trying again — not the raw P2002, which surfaced as
          // a 500 and would page whoever is on the F9.3 app-5xx alarm.
          throw new ConflictException(
            'Could not allocate an incident number, please retry',
          );
        }
      }
    }
    // Unreachable: the loop above always returns or throws.
    throw new ConflictException('Could not allocate an incident number');
  }

  async update(
    id: string,
    dto: UpdateIncidentDto,
    user: AuthenticatedUser,
  ): Promise<IncidentResponseDto> {
    const incident = await this.findScopedOrThrow(id, user);
    if (!this.canEdit(incident, user)) throw new ForbiddenException();

    if (dto.projectId) {
      await this.assertProjectInOrg(dto.projectId, incident.orgId);
    }
    if (dto.typeId) await this.assertTypeExists(dto.typeId);
    if (dto.assigneeIds) {
      await this.assertUsersInOrg(dto.assigneeIds, incident.orgId);
    }
    if (dto.observerIds) {
      await this.assertUsersInOrg(dto.observerIds, incident.orgId);
    }
    if (dto.tagIds) await this.assertTagsInOrg(dto.tagIds, incident.orgId);

    const updated = await this.prisma.incident.update({
      where: { id: incident.id },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.priority !== undefined && { priority: dto.priority }),
        ...(dto.projectId !== undefined && { projectId: dto.projectId }),
        ...(dto.typeId !== undefined && { typeId: dto.typeId }),
        ...(dto.dueDate !== undefined && {
          dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
        }),
        ...(dto.locationDescription !== undefined && {
          locationDescription: dto.locationDescription,
        }),
        ...(dto.coordinates !== undefined && {
          lat: dto.coordinates?.lat ?? null,
          lng: dto.coordinates?.lng ?? null,
        }),
        ...(dto.assigneeIds !== undefined && {
          assignees: {
            deleteMany: {},
            create: dto.assigneeIds.map((userId) => ({ userId })),
          },
        }),
        ...(dto.observerIds !== undefined && {
          observers: {
            deleteMany: {},
            create: dto.observerIds.map((userId) => ({ userId })),
          },
        }),
        ...(dto.tagIds !== undefined && {
          tags: {
            deleteMany: {},
            create: dto.tagIds.map((tagId) => ({ tagId })),
          },
        }),
      },
      include: INCIDENT_INCLUDE,
    });

    if (dto.assigneeIds) {
      const previouslyAssigned = new Set(
        incident.assignees.map((a) => a.userId),
      );
      const newlyAssigned = dto.assigneeIds.filter(
        (userId) => !previouslyAssigned.has(userId),
      );
      await this.notifications.notify(
        incident.orgId,
        incident.id,
        newlyAssigned,
        user.id,
        'assignment',
      );
    }

    return toIncidentResponseDto(updated);
  }

  async updateStatus(
    id: string,
    dto: UpdateIncidentStatusDto,
    user: AuthenticatedUser,
  ): Promise<IncidentResponseDto> {
    const incident = await this.findScopedOrThrow(id, user);
    if (!this.canEdit(incident, user)) throw new ForbiddenException();

    const allowed =
      ALLOWED_STATUS_TRANSITIONS[
        incident.status as keyof typeof ALLOWED_STATUS_TRANSITIONS
      ];
    if (!allowed.includes(dto.status)) {
      throw new ConflictException(
        `Cannot transition from ${incident.status} to ${dto.status}`,
      );
    }

    const data: Prisma.IncidentUpdateInput = { status: dto.status };
    if (dto.status === 'closed') data.closingDate = new Date();
    else if (incident.status === 'closed' && dto.status === 'open') {
      data.closingDate = null;
    }

    const updated = await this.prisma.incident.update({
      where: { id: incident.id },
      data,
      include: INCIDENT_INCLUDE,
    });

    await this.notifications.notify(
      incident.orgId,
      incident.id,
      [incident.ownerId, ...incident.assignees.map((a) => a.userId)],
      user.id,
      'status_changed',
    );

    return toIncidentResponseDto(updated);
  }

  /**
   * `@Roles('admin')` at the controller gates who can even reach this
   * method — unlike edit/status, approval isn't owner/assignee territory.
   * `reason` is accepted for the audit trail F5.6 adds; there's no column
   * for it on Incident itself, only the audit interceptor persists it.
   */
  async updateApproval(
    id: string,
    dto: UpdateIncidentApprovalDto,
    user: AuthenticatedUser,
  ): Promise<IncidentResponseDto> {
    const incident = await this.findScopedOrThrow(id, user);
    if (incident.approval !== 'pending') {
      throw new ConflictException(
        `Incident approval is already ${incident.approval}`,
      );
    }

    const updated = await this.prisma.incident.update({
      where: { id: incident.id },
      data: { approval: dto.decision },
      include: INCIDENT_INCLUDE,
    });

    await this.notifications.notify(
      incident.orgId,
      incident.id,
      [incident.ownerId],
      user.id,
      'approval',
    );

    return toIncidentResponseDto(updated);
  }

  async remove(id: string, user: AuthenticatedUser): Promise<void> {
    const incident = await this.findScopedOrThrow(id, user);
    const isAdmin = user.role === 'admin' || user.role === 'superadmin';
    if (!isAdmin && incident.ownerId !== user.id) {
      throw new ForbiddenException();
    }
    await this.prisma.incident.update({
      where: { id: incident.id },
      data: { deleted: true },
    });
  }

  private canEdit(incident: ScopedIncident, user: AuthenticatedUser): boolean {
    if (user.role === 'admin' || user.role === 'superadmin') return true;
    if (incident.ownerId === user.id) return true;
    return incident.assignees.some((a) => a.userId === user.id);
  }

  /**
   * Lean lookup used by every mutating route: enough to run the permission
   * check (owner/assignee/admin) without pulling the full nested response.
   */
  private async findScopedOrThrow(
    id: string,
    user: AuthenticatedUser,
  ): Promise<ScopedIncident> {
    const incident = await this.prisma.incident.findUnique({
      where: { id },
      include: { assignees: { select: { userId: true } } },
    });
    if (!incident || incident.deleted) throw new NotFoundException();
    if (user.role !== 'superadmin' && incident.orgId !== user.orgId) {
      throw new NotFoundException();
    }
    return incident;
  }

  /**
   * The next human-facing incident number for an organization (F9.5).
   *
   * Derived from the highest number already handed out, not from `count()`.
   * Counting is only correct while nothing is ever removed: one hard-deleted
   * row and the count falls back onto a number that is still in use — and
   * because the candidate is a pure function of the count, every retry would
   * recompute that same taken value and the create would fail permanently
   * rather than converge. A high-water mark is monotonic, and the gaps a
   * deletion leaves are harmless.
   *
   * `@@unique([orgId, sequenceId])` remains what actually guarantees no two
   * incidents share a number. Two concurrent creates do both read the same
   * mark and try the same value; the database rejects the loser, and its
   * retry reads a mark the winner has since moved.
   */
  private async nextSequenceId(orgId: string): Promise<string> {
    const latest = await this.prisma.incident.findFirst({
      where: { orgId },
      // Newest first, because numbers are handed out in creation order.
      // Ordering by `sequenceId` itself would be a *string* comparison, which
      // stops agreeing with numeric order at five digits ('10000' < '9999').
      // The secondary key only breaks ties inside a single millisecond.
      orderBy: [{ createdAt: 'desc' }, { sequenceId: 'desc' }],
      select: { sequenceId: true },
    });
    const parsed = Number.parseInt(latest?.sequenceId ?? '', 10);
    const highest = Number.isFinite(parsed) ? parsed : 0;
    return String(highest + 1).padStart(INCIDENT_SEQUENCE_ID_LENGTH, '0');
  }

  private async assertProjectInOrg(
    projectId: string,
    orgId: string,
  ): Promise<void> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });
    if (!project || project.orgId !== orgId) {
      throw new BadRequestException(
        'projectId does not belong to your organization',
      );
    }
  }

  private async assertTypeExists(typeId: string): Promise<void> {
    const type = await this.prisma.incidentType.findUnique({
      where: { id: typeId },
    });
    if (!type) throw new BadRequestException('typeId does not exist');
  }

  private async assertUsersInOrg(
    userIds: string[],
    orgId: string,
  ): Promise<void> {
    if (userIds.length === 0) return;
    const users = await this.prisma.user.findMany({ where: { orgId } });
    const validIds = new Set(users.map((u) => u.id));
    const invalid = userIds.filter((id) => !validIds.has(id));
    if (invalid.length > 0) {
      throw new BadRequestException(
        `assignee/observer ids not in your organization: ${invalid.join(', ')}`,
      );
    }
  }

  private async assertTagsInOrg(
    tagIds: string[],
    orgId: string,
  ): Promise<void> {
    if (tagIds.length === 0) return;
    const tags = await this.prisma.tag.findMany({ where: { orgId } });
    const validIds = new Set(tags.map((t) => t.id));
    const invalid = tagIds.filter((id) => !validIds.has(id));
    if (invalid.length > 0) {
      throw new BadRequestException(
        `tag ids not in your organization: ${invalid.join(', ')}`,
      );
    }
  }
}
