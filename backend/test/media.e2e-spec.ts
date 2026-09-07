import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { createTestApp } from './utils/test-app';
import type {
  FakePrismaService,
  FakeUser,
  FakeProject,
  FakeIncidentType,
  FakeIncident,
} from './utils/fake-prisma.service';
import type { FakeStorageProvider } from './utils/fake-storage-provider';

interface AccessTokenBody {
  accessToken: string;
}

interface PresignedUploadBody {
  uploadUrl: string;
  fileUrl: string;
}

interface MediaBody {
  id: string;
  incidentId: string;
  type: string;
  format: string;
  size: number;
  status: string;
}

interface GalleryItemBody {
  id: string;
  type: string;
  createdAt: string;
  incident: {
    id: string;
    sequenceId: string;
    title: string;
    project: { id: string; name: string };
  };
}

interface PaginatedBody<T> {
  items: T[];
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

describe('Media (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: FakePrismaService;
  let storage: FakeStorageProvider;
  let orgAMember: FakeUser;
  let orgAOtherMember: FakeUser;
  let orgAAdmin: FakeUser;
  let projectA: FakeProject;
  let plumbingType: FakeIncidentType;
  let incident: FakeIncident;

  beforeEach(async () => {
    ({ app, prisma, storage } = await createTestApp());
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
    projectA = await prisma.seedProject({
      orgId: 'org-a',
      name: 'Edificio Cedro Real',
    });
    plumbingType = await prisma.seedIncidentType({
      key: 'plumbing',
      name: 'Hidrosanitario',
      nameEn: 'Plumbing',
    });
    incident = await prisma.seedIncident({
      orgId: 'org-a',
      projectId: projectA.id,
      typeId: plumbingType.id,
      ownerId: orgAMember.id,
      title: 'Incident with media',
      priority: 'low',
    });
  });

  afterEach(async () => {
    await app.close();
  });

  describe('POST /media/presign', () => {
    it('returns a presigned upload URL for an allowed image type', async () => {
      const token = await loginAs(app, orgAMember, 'password123');

      const res = await request(app.getHttpServer())
        .post('/media/presign')
        .set('Authorization', `Bearer ${token}`)
        .send({
          incidentId: incident.id,
          filename: 'leak.jpg',
          contentType: 'image/jpeg',
          size: 1024 * 1024,
        })
        .expect(200);

      const body = res.body as PresignedUploadBody;
      expect(body.uploadUrl).toContain('X-Amz-Signature');
      expect(body.fileUrl).toContain(incident.id);
      expect(storage.presignedCalls).toHaveLength(1);
      expect(storage.presignedCalls[0].contentType).toBe('image/jpeg');
      // Handed to the signer, so S3 binds the PUT to exactly this many bytes
      // rather than to whatever the caller claimed here (F9.5).
      expect(storage.presignedCalls[0].contentLength).toBe(1024 * 1024);
    });

    it('rejects an unsupported content type with 400', async () => {
      const token = await loginAs(app, orgAMember, 'password123');

      await request(app.getHttpServer())
        .post('/media/presign')
        .set('Authorization', `Bearer ${token}`)
        .send({
          incidentId: incident.id,
          filename: 'malware.exe',
          contentType: 'application/x-msdownload',
          size: 1024,
        })
        .expect(400);
    });

    it('rejects a file over the size limit for its type with 400', async () => {
      const token = await loginAs(app, orgAMember, 'password123');

      await request(app.getHttpServer())
        .post('/media/presign')
        .set('Authorization', `Bearer ${token}`)
        .send({
          incidentId: incident.id,
          filename: 'huge.jpg',
          contentType: 'image/jpeg',
          size: 50 * 1024 * 1024,
        })
        .expect(400);
    });

    it('returns 404 for an incident in another organization', async () => {
      const token = await loginAs(app, orgAMember, 'password123');
      const otherOrgOwner = await prisma.seedUser({
        email: 'owner@org-b.test',
        password: 'password123',
        orgId: 'org-b',
        role: 'member',
        name: 'Org B Owner',
      });
      const otherProject = await prisma.seedProject({
        orgId: 'org-b',
        name: 'Los Almendros',
      });
      const otherIncident = await prisma.seedIncident({
        orgId: 'org-b',
        projectId: otherProject.id,
        typeId: plumbingType.id,
        ownerId: otherOrgOwner.id,
        title: 'Other org incident',
        priority: 'low',
      });

      await request(app.getHttpServer())
        .post('/media/presign')
        .set('Authorization', `Bearer ${token}`)
        .send({
          incidentId: otherIncident.id,
          filename: 'leak.jpg',
          contentType: 'image/jpeg',
          size: 1024,
        })
        .expect(404);
    });
  });

  describe('POST /incidents/:id/media', () => {
    const ORIGIN = 'https://fake-bucket.s3.fake-region.amazonaws.com';

    it('records a media attachment already uploaded to S3', async () => {
      const token = await loginAs(app, orgAMember, 'password123');
      const key = `incidents/${incident.id}/uuid-leak.jpg`;
      storage.putObject(key, { contentType: 'image/jpeg', size: 1024 * 1024 });

      const res = await request(app.getHttpServer())
        .post(`/incidents/${incident.id}/media`)
        .set('Authorization', `Bearer ${token}`)
        .send({ fileUrl: `${ORIGIN}/${key}`, name: 'leak.jpg' })
        .expect(201);

      const body = res.body as MediaBody;
      expect(body.incidentId).toBe(incident.id);
      expect(body.status).toBe('uploaded');
      // Read off the object, not off the request — the request no longer
      // carries any of these (F9.5).
      expect(body.type).toBe('image');
      expect(body.format).toBe('jpg');
      expect(body.size).toBe(1024 * 1024);
    });

    // F9.5. Presigning and recording are separate calls and nothing between
    // them proved the PUT ever happened, so a row could name a key with no
    // object behind it — a gallery tile that 404s, and a delete that erases
    // nothing.
    it('rejects a URL nothing was ever uploaded to with 400', async () => {
      const token = await loginAs(app, orgAMember, 'password123');

      await request(app.getHttpServer())
        .post(`/incidents/${incident.id}/media`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          fileUrl: `${ORIGIN}/incidents/${incident.id}/uuid-never-uploaded.jpg`,
          name: 'ghost.jpg',
        })
        .expect(400);

      expect(prisma.medias).toHaveLength(0);
    });

    // F9.5. The cap used to be selected by the client-declared `type`, so
    // calling a 15 MB image a `video` bought it the 200 MB ceiling. The type
    // now comes from the object, and with it the cap that applies.
    it('applies the cap for the stored type, not one the client could pick', async () => {
      const token = await loginAs(app, orgAMember, 'password123');
      const key = `incidents/${incident.id}/uuid-oversized.jpg`;
      // Under the 200 MB video ceiling, over the 10 MB image one.
      storage.putObject(key, {
        contentType: 'image/jpeg',
        size: 15 * 1024 * 1024,
      });

      await request(app.getHttpServer())
        .post(`/incidents/${incident.id}/media`)
        .set('Authorization', `Bearer ${token}`)
        .send({ fileUrl: `${ORIGIN}/${key}`, name: 'oversized.jpg' })
        .expect(400);

      expect(prisma.medias).toHaveLength(0);
    });

    it('rejects an object whose stored content type is not allowed with 400', async () => {
      const token = await loginAs(app, orgAMember, 'password123');
      const key = `incidents/${incident.id}/uuid-payload.jpg`;
      // A `.jpg` name and an allowed presign do not make the bytes an image:
      // this is what the object actually turned out to be.
      storage.putObject(key, {
        contentType: 'application/x-msdownload',
        size: 2048,
      });

      await request(app.getHttpServer())
        .post(`/incidents/${incident.id}/media`)
        .set('Authorization', `Bearer ${token}`)
        .send({ fileUrl: `${ORIGIN}/${key}`, name: 'payload.jpg' })
        .expect(400);

      expect(prisma.medias).toHaveLength(0);
    });

    // F9.4. The two-step upload hands `fileUrl` back from the browser, and
    // the value is later rendered by the gallery and turned into the key the
    // delete path erases — so an attacker-chosen URL is both a stored-XSS
    // vector and a way to point a delete at somebody else's object.
    it.each([
      ['a host the attacker controls', 'https://attacker.test/x.jpg'],
      ['a javascript: URL', 'javascript:alert(document.cookie)'],
      [
        "another incident's key in our own bucket",
        `${ORIGIN}/incidents/some-other-incident/victim.jpg`,
      ],
    ])('rejects a forged fileUrl (%s) with 400', async (_label, fileUrl) => {
      const token = await loginAs(app, orgAMember, 'password123');
      // Staged so the rejection can only be the origin/prefix rule — the
      // object genuinely exists at the key that URL names.
      storage.putObject('incidents/some-other-incident/victim.jpg', {
        contentType: 'image/jpeg',
        size: 1024,
      });

      await request(app.getHttpServer())
        .post(`/incidents/${incident.id}/media`)
        .set('Authorization', `Bearer ${token}`)
        .send({ fileUrl, name: 'forged.jpg' })
        .expect(400);

      expect(prisma.medias).toHaveLength(0);
    });

    it('stores the canonical URL, not the client string with its query and fragment', async () => {
      const token = await loginAs(app, orgAMember, 'password123');
      const key = `incidents/${incident.id}/uuid-photo.jpg`;
      storage.putObject(key, { contentType: 'image/jpeg', size: 1024 });

      const res = await request(app.getHttpServer())
        .post(`/incidents/${incident.id}/media`)
        .set('Authorization', `Bearer ${token}`)
        .send({ fileUrl: `${ORIGIN}/${key}?evil=1#frag`, name: 'photo.jpg' })
        .expect(201);

      expect((res.body as { url: string }).url).toBe(`${ORIGIN}/${key}`);
    });
  });

  describe('GET /media', () => {
    it('returns a page of media across every incident in the caller org, newest first, with an incident ref', async () => {
      const token = await loginAs(app, orgAMember, 'password123');
      const older = await prisma.seedMedia({
        incidentId: incident.id,
        name: 'older.jpg',
        createdAt: new Date('2026-01-01T00:00:00Z'),
      });
      const newer = await prisma.seedMedia({
        incidentId: incident.id,
        name: 'newer.jpg',
        createdAt: new Date('2026-06-01T00:00:00Z'),
      });

      const res = await request(app.getHttpServer())
        .get('/media')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const body = res.body as PaginatedBody<GalleryItemBody>;
      expect(body.items.map((m) => m.id)).toEqual([newer.id, older.id]);
      expect(body.items[0].incident).toEqual({
        id: incident.id,
        sequenceId: incident.sequenceId,
        title: incident.title,
        project: { id: projectA.id, name: projectA.name },
      });
    });

    it('excludes media belonging to a soft-deleted incident', async () => {
      const token = await loginAs(app, orgAMember, 'password123');
      const deletedIncident = await prisma.seedIncident({
        orgId: 'org-a',
        projectId: projectA.id,
        typeId: plumbingType.id,
        ownerId: orgAMember.id,
        title: 'Deleted incident',
        priority: 'low',
        deleted: true,
      });
      await prisma.seedMedia({ incidentId: incident.id });
      await prisma.seedMedia({ incidentId: deletedIncident.id });

      const res = await request(app.getHttpServer())
        .get('/media')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const body = res.body as PaginatedBody<GalleryItemBody>;
      expect(body.items.every((m) => m.incident.id === incident.id)).toBe(true);
    });

    it('excludes media from another organization', async () => {
      const token = await loginAs(app, orgAMember, 'password123');
      const otherOrgOwner = await prisma.seedUser({
        email: 'gallery-owner@org-b.test',
        password: 'password123',
        orgId: 'org-b',
        role: 'member',
        name: 'Org B Owner',
      });
      const otherProject = await prisma.seedProject({
        orgId: 'org-b',
        name: 'Los Almendros',
      });
      const otherIncident = await prisma.seedIncident({
        orgId: 'org-b',
        projectId: otherProject.id,
        typeId: plumbingType.id,
        ownerId: otherOrgOwner.id,
        title: 'Other org incident',
        priority: 'low',
      });
      await prisma.seedMedia({ incidentId: otherIncident.id });

      const res = await request(app.getHttpServer())
        .get('/media')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const body = res.body as PaginatedBody<GalleryItemBody>;
      expect(body.items.some((m) => m.incident.id === otherIncident.id)).toBe(
        false,
      );
    });

    it('filters by media type', async () => {
      const token = await loginAs(app, orgAMember, 'password123');
      await prisma.seedMedia({ incidentId: incident.id, type: 'image' });
      await prisma.seedMedia({ incidentId: incident.id, type: 'document' });

      const res = await request(app.getHttpServer())
        .get('/media')
        .query('type=image')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const body = res.body as PaginatedBody<GalleryItemBody>;
      expect(body.items.every((m) => m.type === 'image')).toBe(true);
    });

    it('paginates with page/pageSize', async () => {
      const token = await loginAs(app, orgAMember, 'password123');
      for (let i = 0; i < 5; i += 1) {
        await prisma.seedMedia({
          incidentId: incident.id,
          name: `file-${i}.jpg`,
        });
      }

      const res = await request(app.getHttpServer())
        .get('/media')
        .query('page=1&pageSize=2')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const body = res.body as PaginatedBody<GalleryItemBody>;
      expect(body.items).toHaveLength(2);
      expect(body.total).toBe(5);
      expect(body.pageSize).toBe(2);
    });
  });

  describe('DELETE /media/:id', () => {
    it('lets the incident owner delete an attachment, removing the S3 object too', async () => {
      const token = await loginAs(app, orgAMember, 'password123');
      const media = await prisma.seedMedia({ incidentId: incident.id });

      await request(app.getHttpServer())
        .delete(`/media/${media.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(204);

      expect(storage.deletedKeys).toHaveLength(1);
      expect(prisma.medias.find((m) => m.id === media.id)).toBeUndefined();
    });

    it('leaves S3 alone when a stored URL does not resolve to this incident’s key', async () => {
      // A row written before the F9.4 validation existed can still hold any
      // URL at all; deleting it must not turn into a delete of whatever key
      // that URL happens to name.
      const token = await loginAs(app, orgAMember, 'password123');
      const media = await prisma.seedMedia({
        incidentId: incident.id,
        url: 'https://fake-bucket.s3.fake-region.amazonaws.com/incidents/victim/secret.jpg',
      });

      await request(app.getHttpServer())
        .delete(`/media/${media.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(204);

      expect(storage.deletedKeys).toHaveLength(0);
      expect(prisma.medias.find((m) => m.id === media.id)).toBeUndefined();
    });

    it('rejects an unrelated member (not owner, not admin) with 403', async () => {
      const token = await loginAs(app, orgAOtherMember, 'password123');
      const media = await prisma.seedMedia({ incidentId: incident.id });

      await request(app.getHttpServer())
        .delete(`/media/${media.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
    });

    it('lets an admin delete an attachment on an incident they do not own', async () => {
      const token = await loginAs(app, orgAAdmin, 'password123');
      const media = await prisma.seedMedia({ incidentId: incident.id });

      await request(app.getHttpServer())
        .delete(`/media/${media.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(204);
    });

    it('returns 404 for a media id that does not exist', async () => {
      const token = await loginAs(app, orgAAdmin, 'password123');

      await request(app.getHttpServer())
        .delete('/media/does-not-exist')
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });
  });
});
