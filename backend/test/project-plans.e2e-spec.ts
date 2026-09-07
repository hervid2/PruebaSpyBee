import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { createTestApp } from './utils/test-app';
import type {
  FakePrismaService,
  FakeUser,
  FakeProject,
} from './utils/fake-prisma.service';
import type { FakeStorageProvider } from './utils/fake-storage-provider';

interface AccessTokenBody {
  accessToken: string;
}

interface PresignedUploadBody {
  uploadUrl: string;
  fileUrl: string;
}

interface ProjectPlanBody {
  id: string;
  projectId: string;
  name: string;
  type: string;
  format: string;
  size: number;
  url: string;
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

describe('Project plans (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: FakePrismaService;
  let storage: FakeStorageProvider;
  let orgAMember: FakeUser;
  let orgAAdmin: FakeUser;
  let projectA: FakeProject;

  beforeEach(async () => {
    ({ app, prisma, storage } = await createTestApp());
    orgAMember = await prisma.seedUser({
      email: 'member@org-a.test',
      password: 'password123',
      orgId: 'org-a',
      role: 'member',
      name: 'Org A Member',
    });
    orgAAdmin = await prisma.seedUser({
      email: 'admin@org-a.test',
      password: 'password123',
      orgId: 'org-a',
      role: 'admin',
      name: 'Org A Admin',
    });
    projectA = await prisma.seedProject({
      orgId: 'org-a',
      name: 'Edificio Cedro Real',
    });
  });

  afterEach(async () => {
    await app.close();
  });

  describe('POST /projects/:id/plans/presign', () => {
    it('returns a presigned upload URL for an admin, for an allowed image type', async () => {
      const token = await loginAs(app, orgAAdmin, 'password123');

      const res = await request(app.getHttpServer())
        .post(`/projects/${projectA.id}/plans/presign`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          filename: 'floor-1.png',
          contentType: 'image/png',
          size: 1024 * 1024,
        })
        .expect(200);

      const body = res.body as PresignedUploadBody;
      expect(body.uploadUrl).toContain('X-Amz-Signature');
      expect(body.fileUrl).toContain(projectA.id);
      expect(storage.presignedCalls).toHaveLength(1);
      expect(storage.presignedCalls[0].contentType).toBe('image/png');
    });

    it('accepts application/pdf', async () => {
      const token = await loginAs(app, orgAAdmin, 'password123');

      await request(app.getHttpServer())
        .post(`/projects/${projectA.id}/plans/presign`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          filename: 'plans.pdf',
          contentType: 'application/pdf',
          size: 1024,
        })
        .expect(200);
    });

    it('rejects a content type outside image/PDF with 400', async () => {
      const token = await loginAs(app, orgAAdmin, 'password123');

      await request(app.getHttpServer())
        .post(`/projects/${projectA.id}/plans/presign`)
        .set('Authorization', `Bearer ${token}`)
        .send({ filename: 'clip.mp4', contentType: 'video/mp4', size: 1024 })
        .expect(400);
    });

    it('rejects a file over the size limit with 400', async () => {
      const token = await loginAs(app, orgAAdmin, 'password123');

      await request(app.getHttpServer())
        .post(`/projects/${projectA.id}/plans/presign`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          filename: 'huge.png',
          contentType: 'image/png',
          size: 30 * 1024 * 1024,
        })
        .expect(400);
    });

    it('rejects a non-admin member with 403', async () => {
      const token = await loginAs(app, orgAMember, 'password123');

      await request(app.getHttpServer())
        .post(`/projects/${projectA.id}/plans/presign`)
        .set('Authorization', `Bearer ${token}`)
        .send({ filename: 'floor-1.png', contentType: 'image/png', size: 1024 })
        .expect(403);
    });

    it('returns 404 for a project in another organization', async () => {
      const token = await loginAs(app, orgAAdmin, 'password123');
      const otherProject = await prisma.seedProject({
        orgId: 'org-b',
        name: 'Los Almendros',
      });

      await request(app.getHttpServer())
        .post(`/projects/${otherProject.id}/plans/presign`)
        .set('Authorization', `Bearer ${token}`)
        .send({ filename: 'floor-1.png', contentType: 'image/png', size: 1024 })
        .expect(404);
    });
  });

  describe('POST /projects/:id/plans', () => {
    it('records a plan already uploaded to S3', async () => {
      const token = await loginAs(app, orgAAdmin, 'password123');

      const res = await request(app.getHttpServer())
        .post(`/projects/${projectA.id}/plans`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          fileUrl: `https://fake-bucket.s3.fake-region.amazonaws.com/projects/${projectA.id}/plans/floor-1.png`,
          name: 'floor-1.png',
          type: 'image',
          format: 'png',
          size: 1024 * 1024,
        })
        .expect(201);

      const body = res.body as ProjectPlanBody;
      expect(body.projectId).toBe(projectA.id);
      expect(body.type).toBe('image');
    });

    // F9.4, same boundary as `POST /incidents/:id/media`: `fileUrl` comes back
    // from the browser after its direct PUT, and a plan's URL is both rendered
    // as a link/preview and used to choose the object to delete.
    it.each([
      ['a host the attacker controls', 'https://attacker.test/floor-1.png'],
      [
        "another project's key in our own bucket",
        'https://fake-bucket.s3.fake-region.amazonaws.com/projects/other-project/plans/floor-1.png',
      ],
    ])('rejects a forged fileUrl (%s) with 400', async (_label, fileUrl) => {
      const token = await loginAs(app, orgAAdmin, 'password123');

      await request(app.getHttpServer())
        .post(`/projects/${projectA.id}/plans`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          fileUrl,
          name: 'floor-1.png',
          type: 'image',
          format: 'png',
          size: 1024,
        })
        .expect(400);
    });

    it('rejects a non-admin member with 403', async () => {
      const token = await loginAs(app, orgAMember, 'password123');

      await request(app.getHttpServer())
        .post(`/projects/${projectA.id}/plans`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          fileUrl:
            'https://fake-bucket.s3.fake-region.amazonaws.com/x/floor-1.png',
          name: 'floor-1.png',
          type: 'image',
          format: 'png',
          size: 1024,
        })
        .expect(403);
    });

    it('rejects an unsupported declared type with 400', async () => {
      const token = await loginAs(app, orgAAdmin, 'password123');

      await request(app.getHttpServer())
        .post(`/projects/${projectA.id}/plans`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          fileUrl:
            'https://fake-bucket.s3.fake-region.amazonaws.com/x/clip.mp4',
          name: 'clip.mp4',
          type: 'video',
          format: 'mp4',
          size: 1024,
        })
        .expect(400);
    });
  });

  describe('GET /projects/:id/plans', () => {
    it('lists plans for the project, newest first, open to any org member', async () => {
      const token = await loginAs(app, orgAMember, 'password123');
      const older = await prisma.seedProjectPlan({
        projectId: projectA.id,
        name: 'older.pdf',
        createdAt: new Date('2026-01-01T00:00:00Z'),
      });
      const newer = await prisma.seedProjectPlan({
        projectId: projectA.id,
        name: 'newer.pdf',
        createdAt: new Date('2026-06-01T00:00:00Z'),
      });

      const res = await request(app.getHttpServer())
        .get(`/projects/${projectA.id}/plans`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const body = res.body as ProjectPlanBody[];
      expect(body.map((p) => p.id)).toEqual([newer.id, older.id]);
    });

    it('excludes plans from another project', async () => {
      const token = await loginAs(app, orgAMember, 'password123');
      const otherProject = await prisma.seedProject({
        orgId: 'org-a',
        name: 'Otro proyecto',
      });
      await prisma.seedProjectPlan({ projectId: projectA.id });
      await prisma.seedProjectPlan({ projectId: otherProject.id });

      const res = await request(app.getHttpServer())
        .get(`/projects/${projectA.id}/plans`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const body = res.body as ProjectPlanBody[];
      expect(body.every((p) => p.projectId === projectA.id)).toBe(true);
    });

    it('returns 404 for a project in another organization', async () => {
      const token = await loginAs(app, orgAMember, 'password123');
      const otherProject = await prisma.seedProject({
        orgId: 'org-b',
        name: 'Los Almendros',
      });

      await request(app.getHttpServer())
        .get(`/projects/${otherProject.id}/plans`)
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });
  });

  describe('DELETE /plans/:id', () => {
    it('lets an admin delete a plan, removing the S3 object too', async () => {
      const token = await loginAs(app, orgAAdmin, 'password123');
      const plan = await prisma.seedProjectPlan({ projectId: projectA.id });

      await request(app.getHttpServer())
        .delete(`/plans/${plan.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(204);

      expect(storage.deletedKeys).toHaveLength(1);
      expect(prisma.projectPlans.find((p) => p.id === plan.id)).toBeUndefined();
    });

    it('rejects a non-admin member with 403', async () => {
      const token = await loginAs(app, orgAMember, 'password123');
      const plan = await prisma.seedProjectPlan({ projectId: projectA.id });

      await request(app.getHttpServer())
        .delete(`/plans/${plan.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
    });

    it('returns 404 for a plan id that does not exist', async () => {
      const token = await loginAs(app, orgAAdmin, 'password123');

      await request(app.getHttpServer())
        .delete('/plans/does-not-exist')
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });

    it('returns 404 for a plan belonging to another organization', async () => {
      const token = await loginAs(app, orgAAdmin, 'password123');
      const otherProject = await prisma.seedProject({
        orgId: 'org-b',
        name: 'Los Almendros',
      });
      const plan = await prisma.seedProjectPlan({ projectId: otherProject.id });

      await request(app.getHttpServer())
        .delete(`/plans/${plan.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });
  });
});
