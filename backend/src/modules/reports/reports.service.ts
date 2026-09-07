import { Injectable, UnauthorizedException } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { hashToken } from '../../common/utils/hash-token.util';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { DataTokenStatusDto } from './dto/data-token-status.dto';
import { DataTokenCreatedDto } from './dto/data-token-created.dto';
import { DashboardDataQueryDto } from './dto/dashboard-data-query.dto';
import { DashboardDataResponseDto } from './dto/dashboard-data-response.dto';

const STATUS_KEYS = ['open', 'on_pause', 'closed'] as const;
const PRIORITY_KEYS = ['high', 'medium', 'low'] as const;

interface ScopedIncidentRow {
  status: string;
  priority: string;
  createdAt: Date;
  closingDate: Date | null;
  dueDate: Date | null;
  type: { key: string; name: string };
}

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  /** `GET /reports/data-token` — Bearer. Never returns the raw value, only whether one exists. */
  async getTokenStatus(user: AuthenticatedUser): Promise<DataTokenStatusDto> {
    const existing = await this.prisma.exportToken.findUnique({
      where: { userId: user.id },
    });
    return { hasToken: !!existing, createdAt: existing?.createdAt ?? null };
  }

  /**
   * `POST /reports/data-token` — Bearer. Generates (or replaces) the caller's
   * personal data token; a previous token, if any, stops working immediately
   * since only one row per `userId` is kept (`@unique`).
   */
  async generateToken(user: AuthenticatedUser): Promise<DataTokenCreatedDto> {
    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = hashToken(rawToken);
    const record = await this.prisma.exportToken.upsert({
      where: { userId: user.id },
      create: { userId: user.id, orgId: user.orgId, tokenHash },
      update: { tokenHash, orgId: user.orgId },
    });
    return { token: rawToken, createdAt: record.createdAt };
  }

  /** `DELETE /reports/data-token` — Bearer. Idempotent: no-op if none exists. */
  async revokeToken(user: AuthenticatedUser): Promise<void> {
    await this.prisma.exportToken
      .delete({ where: { userId: user.id } })
      .catch(() => undefined);
  }

  /**
   * `GET /reports/dashboard-data` — public, gated entirely by the data token
   * (no session/CurrentUser here). The token arrives either in the
   * `X-Data-Token` header or, for tools that can only be handed a URL, as
   * `?token=`; see `reports.constants.ts` for why both exist and why the
   * header takes precedence. Computes aggregates in memory over the matched
   * incidents, same small-scale approach the frontend's own
   * `dashboard-metrics.selector.ts` already uses for this dataset size.
   */
  async getDashboardData(
    query: DashboardDataQueryDto,
    headerToken?: string,
  ): Promise<DashboardDataResponseDto> {
    const token = headerToken?.trim() || query.token;
    if (!token) throw new UnauthorizedException('Missing data token');
    const tokenRecord = await this.prisma.exportToken.findUnique({
      where: { tokenHash: hashToken(token) },
    });
    if (!tokenRecord) throw new UnauthorizedException('Invalid data token');

    const where: Prisma.IncidentWhereInput = {
      orgId: tokenRecord.orgId,
      deleted: false,
    };
    if (query.status?.length) where.status = { in: query.status };
    if (query.priority?.length) where.priority = { in: query.priority };
    if (query.typeKey?.length) where.type = { key: { in: query.typeKey } };
    if (query.dateFrom || query.dateTo) {
      where.createdAt = {
        ...(query.dateFrom ? { gte: new Date(query.dateFrom) } : {}),
        ...(query.dateTo ? { lte: new Date(query.dateTo) } : {}),
      };
    }

    const items: ScopedIncidentRow[] = await this.prisma.incident.findMany({
      where,
      select: {
        status: true,
        priority: true,
        createdAt: true,
        closingDate: true,
        dueDate: true,
        type: { select: { key: true, name: true } },
      },
    });

    return this.aggregate(items);
  }

  private aggregate(items: ScopedIncidentRow[]): DashboardDataResponseDto {
    const now = new Date();

    const byStatus = STATUS_KEYS.map((status) => ({
      status,
      count: items.filter((i) => i.status === status).length,
    }));
    const byPriority = PRIORITY_KEYS.map((priority) => ({
      priority,
      count: items.filter((i) => i.priority === priority).length,
    }));

    const typeMap = new Map<string, { typeName: string; count: number }>();
    items.forEach((i) => {
      const prev = typeMap.get(i.type.key) ?? {
        typeName: i.type.name,
        count: 0,
      };
      prev.count += 1;
      typeMap.set(i.type.key, prev);
    });
    const byType = Array.from(typeMap.entries())
      .map(([typeKey, { typeName, count }]) => ({ typeKey, typeName, count }))
      .sort((a, b) => b.count - a.count);

    const overdueActiveCount = items.filter(
      (i) => i.status === 'open' && i.dueDate && i.dueDate < now,
    ).length;

    const closedWithDate = items.filter(
      (i) => i.status === 'closed' && i.closingDate,
    );
    const avgResolutionDays =
      closedWithDate.length > 0
        ? Math.round(
            closedWithDate.reduce((acc, i) => {
              const days =
                (i.closingDate!.getTime() - i.createdAt.getTime()) /
                (1000 * 60 * 60 * 24);
              return acc + Math.max(0, days);
            }, 0) / closedWithDate.length,
          )
        : null;

    const trendMap = new Map<string, { created: number; closed: number }>();
    const dayKey = (d: Date) => d.toISOString().slice(0, 10);
    items.forEach((i) => {
      const createdKey = dayKey(i.createdAt);
      const createdEntry = trendMap.get(createdKey) ?? {
        created: 0,
        closed: 0,
      };
      createdEntry.created += 1;
      trendMap.set(createdKey, createdEntry);
      if (i.closingDate) {
        const closedKey = dayKey(i.closingDate);
        const closedEntry = trendMap.get(closedKey) ?? {
          created: 0,
          closed: 0,
        };
        closedEntry.closed += 1;
        trendMap.set(closedKey, closedEntry);
      }
    });
    const trend = Array.from(trendMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, counts]) => ({ date, ...counts }));

    return {
      generatedAt: now.toISOString(),
      totalIncidents: items.length,
      openCount: items.filter((i) => i.status === 'open').length,
      onPauseCount: items.filter((i) => i.status === 'on_pause').length,
      closedCount: items.filter((i) => i.status === 'closed').length,
      overdueActiveCount,
      avgResolutionDays,
      byStatus,
      byPriority,
      byType,
      trend,
    };
  }
}
