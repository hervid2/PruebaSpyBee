import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { createTestApp } from './utils/test-app';
import type {
  FakePrismaService,
  FakeUser,
  FakeProject,
  FakeIncidentType,
} from './utils/fake-prisma.service';
import { DATA_TOKEN_HEADER } from '../src/modules/reports/reports.constants';

interface AccessTokenBody {
  accessToken: string;
}

interface DataTokenStatusBody {
  hasToken: boolean;
  createdAt: string | null;
}

interface DataTokenCreatedBody {
  token: string;
  createdAt: string;
}

interface DashboardDataBody {
  totalIncidents: number;
  openCount: number;
  onPauseCount: number;
  closedCount: number;
  overdueActiveCount: number;
  avgResolutionDays: number | null;
  byStatus: { status: string; count: number }[];
  byPriority: { priority: string; count: number }[];
  byType: { typeKey: string; typeName: string; count: number }[];
}

async function loginAs(
  app: INestApplication<App>,
  user: FakeUser,
  password: string,
): Promise<string> {
  const res = await request(app.getHttpServer())
    .post('/auth/login')
    .send({ email: user.email, password })
    .expect(200);
  return (res.body as AccessTokenBody).accessToken;
}

describe('Reports (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: FakePrismaService;
  let orgAMember: FakeUser;
  let orgBAdmin: FakeUser;
  let projectA: FakeProject;
  let projectB: FakeProject;
  let plumbingType: FakeIncidentType;
  let electricalType: FakeIncidentType;

  beforeEach(async () => {
    ({ app, prisma } = await createTestApp());
    orgAMember = await prisma.seedUser({
      email: 'member@org-a.test',
      password: 'password123',
      orgId: 'org-a',
      role: 'member',
      name: 'Org A Member',
    });
    orgBAdmin = await prisma.seedUser({
      email: 'admin@org-b.test',
      password: 'password123',
      orgId: 'org-b',
      role: 'admin',
      name: 'Org B Admin',
    });
    projectA = await prisma.seedProject({
      orgId: 'org-a',
      name: 'Edificio Cedro Real',
    });
    projectB = await prisma.seedProject({
      orgId: 'org-b',
      name: 'Los Almendros',
    });
    plumbingType = await prisma.seedIncidentType({
      key: 'plumbing',
      name: 'Hidrosanitario',
      nameEn: 'Plumbing',
    });
    electricalType = await prisma.seedIncidentType({
      key: 'electrical',
      name: 'Eléctrico',
      nameEn: 'Electrical',
    });
  });

  afterEach(async () => {
    await app.close();
  });

  describe('GET /incidents/export.csv', () => {
    it('rejects an unauthenticated request with 401', async () => {
      await request(app.getHttpServer())
        .get('/incidents/export.csv')
        .expect(401);
    });

    it("streams the caller org's incidents as CSV, excluding other orgs and soft-deleted rows", async () => {
      await prisma.seedIncident({
        orgId: 'org-a',
        projectId: projectA.id,
        typeId: plumbingType.id,
        ownerId: orgAMember.id,
        title: 'Fuga visible en tubería principal',
        priority: 'high',
        status: 'open',
      });
      await prisma.seedIncident({
        orgId: 'org-a',
        projectId: projectA.id,
        typeId: plumbingType.id,
        ownerId: orgAMember.id,
        title: 'Incidencia eliminada',
        priority: 'low',
        status: 'closed',
        deleted: true,
      });
      await prisma.seedIncident({
        orgId: 'org-b',
        projectId: projectB.id,
        typeId: plumbingType.id,
        ownerId: orgBAdmin.id,
        title: 'Incidencia de otra organización',
        priority: 'high',
        status: 'open',
      });

      const token = await loginAs(app, orgAMember, 'password123');
      const res = await request(app.getHttpServer())
        .get('/incidents/export.csv')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.headers['content-type']).toContain('text/csv');
      expect(res.headers['content-disposition']).toContain('attachment');
      const lines = res.text.trim().split('\r\n');
      expect(lines[0]).toBe(
        'id,title,type,status,priority,approval,project,owner,ownerEmail,assignees,tags,createdAt,dueDate,closingDate,locationDescription,lat,lng',
      );
      expect(lines).toHaveLength(2);
      expect(lines[1]).toContain('Fuga visible en tubería principal');
      expect(res.text).not.toContain('Incidencia eliminada');
      expect(res.text).not.toContain('Incidencia de otra organización');
    });

    it('applies the status filter, same as GET /incidents', async () => {
      await prisma.seedIncident({
        orgId: 'org-a',
        projectId: projectA.id,
        typeId: plumbingType.id,
        ownerId: orgAMember.id,
        title: 'Abierta',
        priority: 'high',
        status: 'open',
      });
      await prisma.seedIncident({
        orgId: 'org-a',
        projectId: projectA.id,
        typeId: plumbingType.id,
        ownerId: orgAMember.id,
        title: 'Cerrada',
        priority: 'low',
        status: 'closed',
      });

      const token = await loginAs(app, orgAMember, 'password123');
      const res = await request(app.getHttpServer())
        .get('/incidents/export.csv?status=open')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.text).toContain('Abierta');
      expect(res.text).not.toContain('Cerrada');
    });
  });

  describe('/reports/data-token', () => {
    it('reports no token until one is generated, then regenerating replaces it', async () => {
      const token = await loginAs(app, orgAMember, 'password123');

      const before = await request(app.getHttpServer())
        .get('/reports/data-token')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect((before.body as DataTokenStatusBody).hasToken).toBe(false);

      const created = await request(app.getHttpServer())
        .post('/reports/data-token')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      const firstRaw = (created.body as DataTokenCreatedBody).token;
      expect(firstRaw).toBeTruthy();

      const after = await request(app.getHttpServer())
        .get('/reports/data-token')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect((after.body as DataTokenStatusBody).hasToken).toBe(true);

      // A valid dashboard-data call with the first token…
      await request(app.getHttpServer())
        .get(`/reports/dashboard-data?token=${firstRaw}`)
        .expect(200);

      // …stops working once regenerated.
      const regenerated = await request(app.getHttpServer())
        .post('/reports/data-token')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      const secondRaw = (regenerated.body as DataTokenCreatedBody).token;
      expect(secondRaw).not.toBe(firstRaw);

      await request(app.getHttpServer())
        .get(`/reports/dashboard-data?token=${firstRaw}`)
        .expect(401);
      await request(app.getHttpServer())
        .get(`/reports/dashboard-data?token=${secondRaw}`)
        .expect(200);
    });

    it('revoking deletes the token and invalidates it', async () => {
      const token = await loginAs(app, orgAMember, 'password123');
      const created = await request(app.getHttpServer())
        .post('/reports/data-token')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      const rawToken = (created.body as DataTokenCreatedBody).token;

      await request(app.getHttpServer())
        .delete('/reports/data-token')
        .set('Authorization', `Bearer ${token}`)
        .expect(204);

      const status = await request(app.getHttpServer())
        .get('/reports/data-token')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect((status.body as DataTokenStatusBody).hasToken).toBe(false);

      await request(app.getHttpServer())
        .get(`/reports/dashboard-data?token=${rawToken}`)
        .expect(401);

      // Idempotent: revoking again (nothing left to revoke) doesn't error.
      await request(app.getHttpServer())
        .delete('/reports/data-token')
        .set('Authorization', `Bearer ${token}`)
        .expect(204);
    });

    it('rejects an unauthenticated caller with 401', async () => {
      await request(app.getHttpServer()).get('/reports/data-token').expect(401);
      await request(app.getHttpServer())
        .post('/reports/data-token')
        .expect(401);
    });
  });

  describe('GET /reports/dashboard-data', () => {
    /** Mints a fresh data token for `orgAMember` through the real endpoint. */
    async function generateDataToken(): Promise<string> {
      const sessionToken = await loginAs(app, orgAMember, 'password123');
      const created = await request(app.getHttpServer())
        .post('/reports/data-token')
        .set('Authorization', `Bearer ${sessionToken}`)
        .expect(200);
      return (created.body as DataTokenCreatedBody).token;
    }

    it('rejects a missing or unknown token with 401', async () => {
      await request(app.getHttpServer())
        .get('/reports/dashboard-data')
        .expect(401);
      await request(app.getHttpServer())
        .get('/reports/dashboard-data?token=not-a-real-token')
        .expect(401);
      await request(app.getHttpServer())
        .get('/reports/dashboard-data')
        .set(DATA_TOKEN_HEADER, 'not-a-real-token')
        .expect(401);
    });

    /**
     * F9.5. `?token=` stays — the endpoint exists so a URL can be pasted into
     * Power BI or Looker Studio, and some of those paths accept nothing else —
     * but a credential in a URL reaches API Gateway access logs, browser
     * history and `Referer` headers, none of which a request header touches.
     * A caller that can set one now has somewhere better to put it.
     */
    it('accepts the token in the X-Data-Token header instead of the query string', async () => {
      const dataToken = await generateDataToken();

      await request(app.getHttpServer())
        .get('/reports/dashboard-data')
        .set(DATA_TOKEN_HEADER, dataToken)
        .expect(200);
    });

    it('prefers the header when both are sent, so a stale URL cannot downgrade the call', async () => {
      const dataToken = await generateDataToken();

      await request(app.getHttpServer())
        .get('/reports/dashboard-data?token=not-a-real-token')
        .set(DATA_TOKEN_HEADER, dataToken)
        .expect(200);
    });

    it("aggregates only the token owner org's incidents, ignoring other orgs", async () => {
      await prisma.seedIncident({
        orgId: 'org-a',
        projectId: projectA.id,
        typeId: plumbingType.id,
        ownerId: orgAMember.id,
        title: 'Open plumbing high',
        priority: 'high',
        status: 'open',
      });
      await prisma.seedIncident({
        orgId: 'org-a',
        projectId: projectA.id,
        typeId: electricalType.id,
        ownerId: orgAMember.id,
        title: 'Closed electrical low',
        priority: 'low',
        status: 'closed',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        closingDate: new Date('2026-01-05T00:00:00.000Z'),
      });
      await prisma.seedIncident({
        orgId: 'org-b',
        projectId: projectB.id,
        typeId: plumbingType.id,
        ownerId: orgBAdmin.id,
        title: 'Other org incident',
        priority: 'high',
        status: 'open',
      });

      const sessionToken = await loginAs(app, orgAMember, 'password123');
      const created = await request(app.getHttpServer())
        .post('/reports/data-token')
        .set('Authorization', `Bearer ${sessionToken}`)
        .expect(200);
      const dataToken = (created.body as DataTokenCreatedBody).token;

      const res = await request(app.getHttpServer())
        .get(`/reports/dashboard-data?token=${dataToken}`)
        .expect(200);
      const body = res.body as DashboardDataBody;

      expect(body.totalIncidents).toBe(2);
      expect(body.openCount).toBe(1);
      expect(body.closedCount).toBe(1);
      expect(body.avgResolutionDays).toBe(4);
      expect(body.byStatus).toEqual(
        expect.arrayContaining([
          { status: 'open', count: 1 },
          { status: 'closed', count: 1 },
        ]),
      );
      expect(body.byPriority).toEqual(
        expect.arrayContaining([
          { priority: 'high', count: 1 },
          { priority: 'low', count: 1 },
        ]),
      );
      expect(body.byType).toEqual(
        expect.arrayContaining([
          { typeKey: 'plumbing', typeName: 'Hidrosanitario', count: 1 },
          { typeKey: 'electrical', typeName: 'Eléctrico', count: 1 },
        ]),
      );
    });

    it('applies the priority filter', async () => {
      await prisma.seedIncident({
        orgId: 'org-a',
        projectId: projectA.id,
        typeId: plumbingType.id,
        ownerId: orgAMember.id,
        title: 'High',
        priority: 'high',
        status: 'open',
      });
      await prisma.seedIncident({
        orgId: 'org-a',
        projectId: projectA.id,
        typeId: plumbingType.id,
        ownerId: orgAMember.id,
        title: 'Low',
        priority: 'low',
        status: 'open',
      });

      const sessionToken = await loginAs(app, orgAMember, 'password123');
      const created = await request(app.getHttpServer())
        .post('/reports/data-token')
        .set('Authorization', `Bearer ${sessionToken}`)
        .expect(200);
      const dataToken = (created.body as DataTokenCreatedBody).token;

      const res = await request(app.getHttpServer())
        .get(`/reports/dashboard-data?token=${dataToken}&priority=high`)
        .expect(200);
      const body = res.body as DashboardDataBody;
      expect(body.totalIncidents).toBe(1);
      expect(body.byPriority).toEqual(
        expect.arrayContaining([{ priority: 'high', count: 1 }]),
      );
      expect(body.byPriority.find((p) => p.priority === 'low')?.count).toBe(0);
    });
  });
});
