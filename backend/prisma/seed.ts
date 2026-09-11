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
 *
 * Two more were added once the demo turned out to leave whole pages empty in
 * every environment (roadmap F9.7):
 *
 * - About a third of incidents get a PDF from `public/mocks/documents.mock.json`
 *   (written with the PDFs by `npm run generate-mock-documents`), picked by
 *   incident type. The mock has images and video but no documents, so
 *   `/documentos` had nothing to list. The URL is relative and served by the
 *   frontend: `MediaService` only signs URLs that resolve to its own bucket
 *   and passes anything else through, which is what a row like this needs.
 * - Each incident gets the audit trail it would have left had it gone through
 *   the API. `AuditLog` is only written by `AuditLogInterceptor` on real
 *   requests, and a seed makes none, so `/historial` had nothing either.
 *
 * Both are derived here rather than added to the mock generator on purpose:
 * that generator dates everything relative to the day it runs, so regenerating
 * the mock to add a field would move every incident's dates as well.
 */
import {
  PrismaClient,
  ApprovalStatus,
  Prisma,
  type AuditAction,
} from '@prisma/client';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import * as bcrypt from 'bcrypt';
import { BCRYPT_SALT_ROUNDS } from '../src/common/constants/security.constants';

const prisma = new PrismaClient();

const DEMO_PASSWORD = 'FlyWorkFlow2026!';

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

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

/** One entry of `public/mocks/documents.mock.json`. */
interface MockDocument {
  slug: string;
  title: string;
  url: string;
  size: number;
  incidentTypes: string[];
}

type SeedAuditRow = Prisma.AuditLogCreateManyInput & {
  metadata: Prisma.InputJsonObject;
  createdAt: Date;
};

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

/**
 * The history an incident in this state would have left behind had it gone
 * through the API. Actions and actors follow the endpoints' own rules —
 * approval is admin-only, so an admin approves — and `metadata` is what
 * `AuditLogInterceptor` stores: the request body that endpoint receives
 * (`{ status }`, `{ decision }`, the create DTO, nothing for a DELETE).
 * Timestamps come from the incident's own dates, then are spaced at least a
 * minute apart, so the history never lists two steps in an arbitrary order,
 * and capped at the moment the seed runs, so nothing is dated in the future.
 */
function buildAuditTrail(params: {
  mock: MockIncident;
  orgId: string;
  incidentId: string;
  ownerId: string;
  adminId: string;
  resolverId: string;
  createBody: Prisma.InputJsonObject;
  now: number;
}): SeedAuditRow[] {
  const { mock } = params;
  const createdAt = new Date(mock.createdAt).getTime();
  const updatedAt = new Date(mock.updatedAt).getTime();
  // In the mock a closed incident's last change is its closing.
  const statusAt =
    mock.status === 'closed' && mock.closingDate
      ? new Date(mock.closingDate).getTime()
      : updatedAt;

  const events: {
    action: AuditAction;
    actorId: string;
    metadata: Prisma.InputJsonObject;
    at: number;
  }[] = [
    {
      action: 'created',
      actorId: params.ownerId,
      metadata: params.createBody,
      at: createdAt,
    },
  ];

  if (mock.approval) {
    // Within a day of creation, and before whatever happened next.
    const gap = Math.max(statusAt - createdAt, 0);
    events.push({
      action: 'approved',
      actorId: params.adminId,
      metadata: { decision: 'approved' },
      at: createdAt + Math.min(DAY_MS, gap / 2),
    });
  }

  if (mock.status !== 'open') {
    events.push({
      action: 'status_changed',
      actorId: params.resolverId,
      metadata: { status: mock.status },
      at: statusAt,
    });
  } else if (updatedAt - createdAt >= DAY_MS) {
    events.push({
      action: 'updated',
      actorId: params.ownerId,
      metadata: { priority: mock.priority },
      at: updatedAt,
    });
  }

  if (mock.deleted) {
    events.push({
      action: 'deleted',
      actorId: params.ownerId,
      metadata: {},
      at: statusAt + 3 * HOUR_MS,
    });
  }

  for (let i = 1; i < events.length; i++) {
    events[i].at = Math.max(events[i].at, events[i - 1].at + MINUTE_MS);
  }
  // A few mock incidents are closed on a date after today (the generator
  // allows closings up to 60 days out). Capping each at the instant the seed
  // runs would stack them on one timestamp at the top of `/historial`, so the
  // cap for the last step is spread over the preceding three days instead.
  const latest = params.now - ((hashOf(mock.id) % 72) + 1) * HOUR_MS;
  for (let i = events.length - 1; i >= 0; i--) {
    const ceiling =
      i === events.length - 1 ? latest : events[i + 1].at - MINUTE_MS;
    events[i].at = Math.min(events[i].at, ceiling);
  }

  return events.map((event) => ({
    orgId: params.orgId,
    incidentId: params.incidentId,
    actorId: event.actorId,
    action: event.action,
    metadata: event.metadata,
    createdAt: new Date(event.at),
  }));
}

async function main() {
  const now = Date.now();
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

  function adminOfOrg(orgName: string) {
    const admin = USER_DEFS.find(
      (u) => u.company === orgName && u.role === 'admin',
    );
    if (!admin) throw new Error(`No admin seeded for ${orgName}`);
    return usersByEmail.get(admin.email)!;
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

  const documentsPath = resolve(
    __dirname,
    '../../public/mocks/documents.mock.json',
  );
  const mockDocuments = JSON.parse(
    readFileSync(documentsPath, 'utf-8'),
  ) as MockDocument[];
  const documentByType = new Map(
    mockDocuments.flatMap((doc) =>
      doc.incidentTypes.map((key) => [key, doc] as const),
    ),
  );
  const typesWithoutDocument = TYPES.filter((t) => !documentByType.has(t.key));
  if (typesWithoutDocument.length > 0) {
    throw new Error(
      `documents.mock.json has no document for: ${typesWithoutDocument
        .map((t) => t.key)
        .join(
          ', ',
        )}. Run \`npm run generate-mock-documents\` at the repo root.`,
    );
  }

  // Makes the script safely re-runnable without a full `migrate reset`:
  // incidents are always regenerated from the mock dataset, while
  // organizations/users/projects/tags/types are upserted above and left
  // untouched. Cascades clear every join/media/audit/notification row too.
  await prisma.incident.deleteMany({});

  const sequenceCounters = new Map<string, number>();
  const auditRows: SeedAuditRow[] = [];
  let documentCount = 0;

  for (const mock of mockIncidents) {
    const orgName = projectNameToOrgName.get(mock.project.name);
    if (!orgName) continue; // safety net; every seeded project name is mapped above

    const org = orgsByName.get(orgName)!;
    const project = projectByOrgName.get(orgName)!;
    const type = typesByKey.get(mock.type.key);
    if (!type) continue;

    const owner = remapToOrg(mock.owner, orgName);
    const assigneeIds = [
      ...new Set(mock.assignees.map((a) => remapToOrg(a, orgName).id)),
    ];
    const observerIds = [
      ...new Set(mock.observers.map((o) => remapToOrg(o, orgName).id)),
    ];
    const tags = mock.tags
      .map((t) => tagsByOrgAndName.get(`${orgName}::${t.name}`))
      .filter((t): t is { id: string } => Boolean(t));

    const nextSeq = (sequenceCounters.get(orgName) ?? 0) + 1;
    sequenceCounters.set(orgName, nextSeq);
    const sequenceId = String(nextSeq).padStart(4, '0');

    // Stable per incident, so a re-seed attaches the same documents.
    const incidentHash = hashOf(mock.id);
    const document =
      incidentHash % 3 === 0 ? documentByType.get(mock.type.key) : undefined;
    if (document) documentCount++;

    const incident = await prisma.incident.create({
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
          create: assigneeIds.map((userId) => ({ userId })),
        },
        observers: {
          create: observerIds.map((userId) => ({ userId })),
        },
        tags: {
          create: tags.map((t) => ({ tagId: t.id })),
        },
        media: {
          create: [
            ...mock.media.map((m) => ({
              name: m.name,
              type: m.type,
              format: m.format,
              size: m.size,
              status: m.status,
              url: m.url,
            })),
            ...(document
              ? [
                  {
                    name: `${document.slug}-${sequenceId}.pdf`,
                    type: 'document' as const,
                    format: 'pdf',
                    size: document.size,
                    status: 'uploaded' as const,
                    url: document.url,
                    // Filed a few hours after the incident, not at seed time:
                    // `/documentos` shows the date and sorts by it.
                    createdAt: new Date(
                      Math.min(
                        new Date(mock.createdAt).getTime() +
                          (2 + (incidentHash % 36)) * HOUR_MS,
                        now,
                      ),
                    ),
                  },
                ]
              : []),
          ],
        },
      },
    });

    auditRows.push(
      ...buildAuditTrail({
        mock,
        orgId: org.id,
        incidentId: incident.id,
        ownerId: owner.id,
        adminId: adminOfOrg(orgName).id,
        resolverId: assigneeIds[0] ?? owner.id,
        createBody: {
          projectId: project.id,
          typeId: type.id,
          title: mock.title,
          description: mock.description,
          priority: mock.priority,
          ...(mock.dueDate ? { dueDate: mock.dueDate } : {}),
          ...(mock.locationDescription
            ? { locationDescription: mock.locationDescription }
            : {}),
          ...(mock.coordinates ? { coordinates: mock.coordinates } : {}),
          assigneeIds,
          observerIds,
          tagIds: tags.map((t) => t.id),
        },
        now,
      }),
    );
  }

  await prisma.auditLog.createMany({ data: auditRows });

  console.log(
    `Seeded ${orgsByName.size} organizations, ${usersByEmail.size} users, ${mockIncidents.length} incidents, ${documentCount} documents, ${auditRows.length} audit log entries.`,
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
