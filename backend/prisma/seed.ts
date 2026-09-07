/**
 * Loads the fictional dataset from `public/mocks/incidents.mock.json` (see
 * roadmap.md F1.3) into the relational schema. The frontend mock predates
 * multi-tenancy, so this script makes a few explicit modeling decisions to
 * turn it into org-scoped data:
 *
 * - Each construction company (`CONSTRUCTORA DEL VALLE`, `GRUPO MERIDIANO`)
 *   becomes an Organization with its own Project, matching the project each
 *   incident was already assigned to in the mock data.
 * - `FLYWORKFLOW` becomes a third Organization with no project of its own —
 *   it's the platform vendor's internal org, home to the `superadmin`
 *   account (cross-org visibility, requirements.md §1.6 Should).
 * - An incident's `orgId` is derived from its (org-exclusive) project, not
 *   from its owner — the mock picked owner/assignees/observers uniformly
 *   across all users, so anyone landing outside that org gets deterministically
 *   remapped to a same-org user instead (keeping array lengths, dropping none
 *   of the 200 incidents).
 * - Tags are org-exclusive (data-model.md), so the original 8-tag catalog is
 *   duplicated into each construction org and incident tags are remapped to
 *   their own org's copies.
 */
import { PrismaClient, ApprovalStatus } from '@prisma/client';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import * as bcrypt from 'bcrypt';
import { BCRYPT_SALT_ROUNDS } from '../src/common/constants/security.constants';

const prisma = new PrismaClient();

const DEMO_PASSWORD = 'FlyWorkFlow2026!';

interface MockUserRef {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
}

interface MockIncident {
  id: string;
  sequenceId: string;
  title: string;
  description: string;
  type: { key: string; name: string; name_en: string };
  priority: 'high' | 'medium' | 'low';
  status: 'open' | 'on_pause' | 'closed';
  approval: boolean;
  project: { name: string };
  owner: MockUserRef;
  assignees: MockUserRef[];
  observers: MockUserRef[];
  coordinates: { lat: number; lng: number } | null;
  locationDescription: string | null;
  dueDate: string | null;
  closingDate: string | null;
  media: {
    name: string;
    type: 'image' | 'video' | 'document';
    format: string;
    size: number;
    status: 'uploaded' | 'pending' | 'error';
    url: string;
  }[];
  tags: { name: string; color: string }[];
  deleted?: boolean | null;
  createdAt: string;
  updatedAt: string;
}

const TYPES = [
  { key: 'plumbing', name: 'Hidrosanitario', nameEn: 'Plumbing' },
  {
    key: 'coordination',
    name: 'Coordinación de Diseños',
    nameEn: 'Coordination',
  },
  { key: 'electrical', name: 'Electrico', nameEn: 'Electrical' },
  { key: 'infrastructure', name: 'Infraestructura', nameEn: 'Infrastructure' },
  {
    key: 'safety_hazard',
    name: 'Prevención de riesgos',
    nameEn: 'Safety hazard',
  },
  { key: 'structural', name: 'Estructural', nameEn: 'Structural' },
  { key: 'materials', name: 'Materiales', nameEn: 'Materials' },
  { key: 'masonry', name: 'Mamposteria', nameEn: 'Masonry' },
  { key: 'architectural', name: 'Arquitectónico', nameEn: 'Architectural' },
  { key: 'stability', name: 'Estabilidad', nameEn: 'Stability' },
  {
    key: 'observation',
    name: 'Observación General',
    nameEn: 'General Observation',
  },
  { key: 'excavation', name: 'Excavación', nameEn: 'Excavation' },
  { key: 'foundation', name: 'Cimentación', nameEn: 'Foundation' },
  { key: 'soil-study', name: 'Estudio de Suelos', nameEn: 'Soil Study' },
  {
    key: 'urban_planning',
    name: 'Planeación Urbana',
    nameEn: 'Urban Planning',
  },
];

const ORG_DEFS = [
  {
    name: 'Constructora del Valle',
    projectName: 'Edificio Cedro Real - Etapa 1',
  },
  {
    name: 'Grupo Meridiano',
    projectName: 'Conjunto Residencial Los Almendros',
  },
  { name: 'FlyWorkFlow', projectName: null },
];

const USER_DEFS: {
  name: string;
  email: string;
  avatarUrl: string;
  company: string;
  role: 'member' | 'admin' | 'superadmin';
}[] = [
  {
    name: 'Diego Salazar',
    email: 'diego.salazar@constructoradelvalle.com',
    avatarUrl: 'https://i.pravatar.cc/150?u=diego.salazar',
    company: 'Constructora del Valle',
    role: 'member',
  },
  {
    name: 'Paula Restrepo',
    email: 'paula.restrepo@constructoradelvalle.com',
    avatarUrl: 'https://i.pravatar.cc/150?u=paula.restrepo',
    company: 'Constructora del Valle',
    role: 'member',
  },
  {
    name: 'Tomás Beltrán',
    email: 'tomas.beltran@constructoradelvalle.com',
    avatarUrl: 'https://i.pravatar.cc/150?u=tomas.beltran',
    company: 'Constructora del Valle',
    role: 'member',
  },
  {
    name: 'Camilo Duarte',
    email: 'camilo.duarte@constructoradelvalle.com',
    avatarUrl: 'https://i.pravatar.cc/150?u=camilo.duarte',
    company: 'Constructora del Valle',
    role: 'member',
  },
  {
    name: 'Isabela Nieto',
    email: 'isabela.nieto@constructoradelvalle.com',
    avatarUrl: 'https://i.pravatar.cc/150?u=isabela.nieto',
    company: 'Constructora del Valle',
    role: 'admin',
  },
  {
    name: 'Camila Rojas',
    email: 'camila.rojas@flyworkflow.io',
    avatarUrl: 'https://i.pravatar.cc/150?u=camila.rojas',
    company: 'FlyWorkFlow',
    role: 'superadmin',
  },
  {
    name: 'Andrés Vargas',
    email: 'andres.vargas@flyworkflow.io',
    avatarUrl: 'https://i.pravatar.cc/150?u=andres.vargas',
    company: 'FlyWorkFlow',
    role: 'member',
  },
  {
    name: 'Laura Méndez',
    email: 'laura.mendez@flyworkflow.io',
    avatarUrl: 'https://i.pravatar.cc/150?u=laura.mendez',
    company: 'FlyWorkFlow',
    role: 'member',
  },
  {
    name: 'Santiago Ibarra',
    email: 'santiago.ibarra@grupomeridiano.com',
    avatarUrl: 'https://i.pravatar.cc/150?u=santiago.ibarra',
    company: 'Grupo Meridiano',
    role: 'member',
  },
  {
    name: 'Valeria Cárdenas',
    email: 'valeria.cardenas@grupomeridiano.com',
    avatarUrl: 'https://i.pravatar.cc/150?u=valeria.cardenas',
    company: 'Grupo Meridiano',
    role: 'admin',
  },
];

const TAGS = [
  { name: 'Reproceso', color: '#EF4444' },
  { name: 'Acabados', color: '#6366F1' },
  { name: 'Urgente', color: '#F59E0B' },
  { name: 'Humedad', color: '#3B82F6' },
  { name: 'Cliente', color: '#EC4899' },
  { name: 'Seguridad', color: '#10B981' },
  { name: 'Calidad', color: '#8B5CF6' },
  { name: 'Garantía', color: '#14B8A6' },
];

function hashOf(text: string): number {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) | 0;
  return Math.abs(h);
}

async function main() {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, BCRYPT_SALT_ROUNDS);

  const orgsByName = new Map<string, { id: string }>();
  for (const def of ORG_DEFS) {
    const org = await prisma.organization.upsert({
      where: { name: def.name },
      update: {},
      create: { name: def.name },
    });
    orgsByName.set(def.name, org);
  }

  const projectByOrgName = new Map<string, { id: string }>();
  for (const def of ORG_DEFS) {
    if (!def.projectName) continue;
    const org = orgsByName.get(def.name)!;
    const existing = await prisma.project.findFirst({
      where: { orgId: org.id, name: def.projectName },
    });
    const project =
      existing ??
      (await prisma.project.create({
        data: { orgId: org.id, name: def.projectName },
      }));
    projectByOrgName.set(def.name, project);
  }

  const usersByEmail = new Map<string, { id: string; orgName: string }>();
  for (const def of USER_DEFS) {
    const org = orgsByName.get(def.company)!;
    const user = await prisma.user.upsert({
      where: { email: def.email },
      update: {},
      create: {
        orgId: org.id,
        name: def.name,
        email: def.email,
        passwordHash,
        role: def.role,
        avatarUrl: def.avatarUrl,
      },
    });
    usersByEmail.set(def.email, { id: user.id, orgName: def.company });
  }
  // Original mock users were addressed by their frontend id — resolve those
  // through email since Prisma assigns its own uuids.
  const usersById = new Map<string, { id: string; orgName: string }>();
  const MOCK_ID_TO_EMAIL: Record<string, string> = {
    a3f7c1d8e6b94025f8a1c7d2: 'diego.salazar@constructoradelvalle.com',
    b8e2f4a9c1d7360be5f2a8c4: 'paula.restrepo@constructoradelvalle.com',
    c5a9d3e7f2b84671ac6d3e9f: 'tomas.beltran@constructoradelvalle.com',
    d1c6b8a4e9f73582bd7e4f0a: 'camilo.duarte@constructoradelvalle.com',
    e4f8a2c6d1b95793ce8f5a1b: 'isabela.nieto@constructoradelvalle.com',
    flyworkflow_u1: 'camila.rojas@flyworkflow.io',
    flyworkflow_u2: 'andres.vargas@flyworkflow.io',
    flyworkflow_u3: 'laura.mendez@flyworkflow.io',
    meridiano_u1: 'santiago.ibarra@grupomeridiano.com',
    meridiano_u2: 'valeria.cardenas@grupomeridiano.com',
  };
  for (const [mockId, email] of Object.entries(MOCK_ID_TO_EMAIL)) {
    usersById.set(mockId, usersByEmail.get(email)!);
  }

  const typesByKey = new Map<string, { id: string }>();
  for (const t of TYPES) {
    const type = await prisma.incidentType.upsert({
      where: { key: t.key },
      update: { name: t.name, nameEn: t.nameEn },
      create: t,
    });
    typesByKey.set(t.key, type);
  }

  const tagsByOrgAndName = new Map<string, { id: string }>();
  for (const orgName of ['Constructora del Valle', 'Grupo Meridiano']) {
    const org = orgsByName.get(orgName)!;
    for (const tag of TAGS) {
      const existing = await prisma.tag.findFirst({
        where: { orgId: org.id, name: tag.name },
      });
      const row =
        existing ??
        (await prisma.tag.create({
          data: { orgId: org.id, name: tag.name, color: tag.color },
        }));
      tagsByOrgAndName.set(`${orgName}::${tag.name}`, row);
    }
  }

  const projectNameToOrgName = new Map(
    ORG_DEFS.filter((d) => d.projectName).map((d) => [
      d.projectName as string,
      d.name,
    ]),
  );

  function usersOfOrg(orgName: string) {
    return USER_DEFS.filter((u) => u.company === orgName).map((u) =>
      usersByEmail.get(u.email)!,
    );
  }

  function remapToOrg(user: MockUserRef, orgName: string) {
    const resolved = usersById.get(user.id);
    if (resolved && resolved.orgName === orgName) return resolved;
    const pool = usersOfOrg(orgName);
    return pool[hashOf(user.id) % pool.length];
  }

  const mockPath = resolve(__dirname, '../../public/mocks/incidents.mock.json');
  const mockIncidents = JSON.parse(
    readFileSync(mockPath, 'utf-8'),
  ) as MockIncident[];

  // Makes the script safely re-runnable without a full `migrate reset`:
  // incidents are always regenerated from the mock dataset, while
  // organizations/users/projects/tags/types are upserted above and left
  // untouched. Cascades clear every join/media/audit/notification row too.
  await prisma.incident.deleteMany({});

  const sequenceCounters = new Map<string, number>();

  for (const mock of mockIncidents) {
    const orgName = projectNameToOrgName.get(mock.project.name);
    if (!orgName) continue; // safety net; every seeded project name is mapped above

    const org = orgsByName.get(orgName)!;
    const project = projectByOrgName.get(orgName)!;
    const type = typesByKey.get(mock.type.key);
    if (!type) continue;

    const owner = remapToOrg(mock.owner, orgName);
    const assignees = mock.assignees.map((a) => remapToOrg(a, orgName));
    const observers = mock.observers.map((o) => remapToOrg(o, orgName));
    const tags = mock.tags
      .map((t) => tagsByOrgAndName.get(`${orgName}::${t.name}`))
      .filter((t): t is { id: string } => Boolean(t));

    const nextSeq = (sequenceCounters.get(orgName) ?? 0) + 1;
    sequenceCounters.set(orgName, nextSeq);
    const sequenceId = String(nextSeq).padStart(4, '0');

    await prisma.incident.create({
      data: {
        sequenceId,
        orgId: org.id,
        projectId: project.id,
        typeId: type.id,
        title: mock.title,
        description: mock.description,
        priority: mock.priority,
        status: mock.status,
        approval: mock.approval
          ? ApprovalStatus.approved
          : ApprovalStatus.pending,
        ownerId: owner.id,
        deleted: mock.deleted ?? false,
        lat: mock.coordinates?.lat ?? null,
        lng: mock.coordinates?.lng ?? null,
        locationDescription: mock.locationDescription,
        dueDate: mock.dueDate ? new Date(mock.dueDate) : null,
        closingDate: mock.closingDate ? new Date(mock.closingDate) : null,
        createdAt: new Date(mock.createdAt),
        updatedAt: new Date(mock.updatedAt),
        assignees: {
          create: [...new Set(assignees.map((a) => a.id))].map((userId) => ({
            userId,
          })),
        },
        observers: {
          create: [...new Set(observers.map((o) => o.id))].map((userId) => ({
            userId,
          })),
        },
        tags: {
          create: tags.map((t) => ({ tagId: t.id })),
        },
        media: {
          create: mock.media.map((m) => ({
            name: m.name,
            type: m.type,
            format: m.format,
            size: m.size,
            status: m.status,
            url: m.url,
          })),
        },
      },
    });
  }

  console.log(
    `Seeded ${orgsByName.size} organizations, ${usersByEmail.size} users, ${mockIncidents.length} incidents.`,
  );
  console.log(`Demo login password for every seeded user: ${DEMO_PASSWORD}`);
}

main()
  .catch((e: unknown) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
