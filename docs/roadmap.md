# Iteration Roadmap — FlyWorkFlow

> Planning document, versioned alongside the code. Last updated: 2026-09-05.
> Each iteration = one git branch, one scoped work cycle. When closing an iteration, use `scripts/commit-push.ps1` with the suggested message. This document does **not duplicate** content from `requirements.md` or `best-practices.md` — it only references the exact section that applies to each task.
>
> Base branch for every iteration: `develop`. PRs target `develop`; `main` only receives merges from an already-validated `develop` (a pattern the repo already uses).
>
> Process note: iterations whose only change is a document (`docs/*.md`) produce a `docs:` commit without touching product code — `scripts/commit-push.ps1` treats them like any other versioned change.

---

## Phase 0 — Documentation and process foundations _(complete)_

**F0.1 — `docs/bootstrap-roadmap`**
Goal: create the documentation and tooling scaffold that governs the rest of the roadmap.
Tasks: create `docs/{requirements,best-practices,aws-deploy-guide,data-model,api-contracts,glossary}.md` and this document; create `scripts/commit-push.ps1`; confirm `develop` as the base branch.
Commit: `docs: bootstrap docs/ scaffold and commit-push script`

---

## Phase 1 — Brand identity and domain data _(complete)_

Blocks everything else: no later iteration should introduce code or copy inconsistent with the FlyWorkFlow identity. Runs before any fix or feature.

**F1.1 — `chore/brand-identity-audit`**
Goal: have all code —visible copy, metadata, technical names— consistently use the FlyWorkFlow identity.
Tasks: `package.json` (`name`, `description`), Next.js `<title>`/metadata, visible copy in `TopBar`, `SidebarNav`, the login page, README; session cookie names in `useAuthStore.ts` and `middleware.ts` standardized to the `flyworkflow-*` prefix; audit any CSS class prefix or constant that doesn't follow that convention.
Docs: `best-practices.md §Next.js / React` (semantic naming).
Commit: `chore: align session cookie names and copy with FlyWorkFlow naming`

**F1.2 — `feat/brand-icon-mark`**
Goal: a brand icon of its own — the fly (Level B: circle, eyes and wings, no antennae — same stroke at every size, decision already validated) — keeping the existing color palette (`$color-accent-gold`, `$color-bg-dark`).
Tasks: `FlyIcon.tsx` component, used in TopBar, SidebarNav, login, favicon/`favicon.ico`, OG metadata; confirm the hexagon motif in user avatars is a generic shape and not a brand reference (if an unclear case comes up while running this iteration, confirm with the user).
Docs: `best-practices.md §Accessibility` (`aria-label` on the icon when it acts as a button).
Commit: `feat: add FlyWorkFlow brand icon across TopBar, sidebar and favicon`

**F1.3 — `feat/generate-mock-dataset`**
Goal: a mock dataset of its own, fictional, with the exact shape the domain already uses (`incidents.mock.json`, `mock-users.ts`).
Tasks: a generation script (`scripts/generate-mock-data.ts`, the intermediate output isn't versioned if regenerating on every run is chosen, the final `public/mocks/incidents.mock.json` is versioned) that produces ~200 fictional incidents keeping the exact schema of `domain/models/incident.model.ts` (including `deleted`, and deciding whether to adopt `whatsappOwner` or formally drop it); fictional user, company and project names (none should match real people or companies); the same 15 incident type keys the domain already uses.
Docs: `requirements.md §1.2 Incident Management` (full catalog of 15 types).
Commit: `feat: generate fictional mock dataset for the FlyWorkFlow domain`

---

## Phase 2 — Technical debt and quick wins (frontend-only) _(complete)_

Parallelizable with Phase 3 (there's no real dependency between frontend fixes and backend scaffolding); listed in this order purely for reading clarity. See `frontend-architecture.md` for the layers and files these tasks operate on.

**F2.1 — `fix/dashboard-company-filter-table`** — Fixes the company filter not reaching `CriticalIssuesList.tsx` (confirmed bug, lines 266-287 vs. `dashboard-metrics.selector.ts` lines 67-80). A test that reproduces the bug before the fix. Docs: `best-practices.md §Testing`. Commit: `fix(dashboard): apply company filters to critical issues table`

**F2.2 — `fix/category-manager-integration`** — Connects `CategoryManagerModal` to `IssueForm`'s real `<select>` catalog (today it uses a disconnected `sessionCategories` array). Commit: `fix(create-issue): connect category manager to the real type catalog`

**F2.3 — `fix/incident-types-catalog-gap`** — Completes the selectable type catalog. Docs: `requirements.md §1.2`. Commit: `fix(catalog): add missing incident types to selectable list`

**F2.4 — `fix/owner-project-from-session`** — Removes hardcoded `MOCK_OWNER`/`MOCK_PROJECT` in `IssueForm.tsx`; uses `useAuthStore` and a real project selector. Docs: `requirements.md §1.2`. Commit: `fix(create-issue): use authenticated user and real project selection`

**F2.5 — `feat/map-clustering-supercluster`** — Real marker clustering (`supercluster`, installed but unused). Docs: `requirements.md §1.3`. Commit: `feat(map): cluster incident markers with supercluster`

**F2.6 — `fix/map-filter-bar-real-filtering`** — Makes `MapFilterBar` actually filter markers (a bug, not decorative). Docs: `requirements.md §1.3`. Commit: `fix(map): apply date and last-visits filters to visible markers`

**F2.7 — `feat/i18n-real`** — Functional TopBar language switcher with `next-intl`: real ES/EN on the map, dashboard, modals and validation messages (not just navigation). Elevated to Must and moved to this phase because it doesn't depend on the backend and because being able to show the demo in English matters for an international portfolio. Docs: `requirements.md §1.9`. Commit: `feat(frontend): add real i18n with working language switcher`

**F2.8 — `feat/responsive-tables-and-modals`** — Applies the responsive table pattern and the mobile modal criteria from `requirements.md §1.12` to `CriticalIssuesList` and the three existing modals; adds the first E2E test case at a mobile viewport. Doesn't depend on the backend. Docs: `requirements.md §1.12`, `best-practices.md §Responsive / Adaptive Design`. Commit: `feat(frontend): apply responsive table pattern and mobile-ready modals`

---

## Phase 3 — Backend: foundations and local infrastructure (no AWS) _(complete)_

**F3.1 — `chore/backend-scaffold-nestjs`** — Bootstraps NestJS in `backend/` (modular structure, see `requirements.md §3.2` for the stack rationale). `HealthModule` (`GET /health`). Docs: `best-practices.md §NestJS, §TypeScript`. Commit: `chore(backend): scaffold NestJS project structure and tooling`

**F3.2 — `ci/backend-quality-job`** — `backend-ci.yml` workflow (`paths: backend/**`): lint→type-check→test→build. Docs: `best-practices.md §AWS SAM / CI-CD`. Commit: `ci(backend): add lint/test/build pipeline scoped to backend changes`

**F3.3 — `feat/backend-prisma-railway`** — Initial Prisma schema (Organization, User, Project, Incident, IncidentType, Tag, Media, RefreshToken) + Railway connection; `seed.ts` loads the dataset regenerated in F1.3. Docs: `requirements.md §1.6`, `best-practices.md §Prisma / SQL`. Commit: `feat(backend): add initial Prisma schema, Railway connection and seed script`

**F3.4 — `build/backend-dockerfile-local`** — Multi-stage Dockerfile (Lambda Node.js base image), `.dockerignore`, local smoke test with the Runtime Interface Emulator. Docs: `aws-deploy-guide.md §Construir y probar la imagen Docker localmente` (a personal AWS guide, kept in Spanish — see that file's own header note), `best-practices.md §Docker`. Commit: `build(backend): add Lambda-compatible Dockerfile with local smoke test`

**F3.5 — `chore/backend-sam-local`** — `template.yaml` (`PackageType: Image`), `sam build`, `sam local start-api`, test `/health` end-to-end locally. Docs: `aws-deploy-guide.md §Instalar las herramientas en tu computador` (SAM CLI) and `§Configurar AWS CLI con tus credenciales`. Commit: `chore(backend): add SAM template and validate local start-api`

---

## Phase 4 — Backend: real auth and multi-tenancy _(complete)_

**F4.1 — `feat/backend-auth-jwt`** — `AuthModule` (Passport local + JWT strategies), `/auth/login`, `/auth/refresh`, `/auth/logout` with revocation. Docs: `requirements.md §1.1`, `best-practices.md §Security`. Commit: `feat(backend): implement JWT auth with bcrypt and refresh rotation`

**F4.2 — `feat/backend-rbac-organizations`** — `OrganizationsModule`/`UsersModule`, `RolesGuard`/`OrgScopeGuard`; seed of fictional organizations and users (F1.3). Docs: `requirements.md §1.6`, `best-practices.md §NestJS` (SOLID). Commit: `feat(backend): add organizations, roles and tenant-scoping guards`

**F4.3 — `test/backend-auth-e2e-hardening`** — Negative cases (expired token, insufficient role, cross-org denied), login rate limiting. Docs: `best-practices.md §Security`. Commit: `test(backend): harden auth and RBAC e2e coverage with rate limiting`

---

## Phase 5 — Backend: incident domain _(complete)_

**F5.1 — `feat/backend-projects-module`** — Project CRUD scoped per organization. Commit: `feat(backend): add projects module scoped by organization`

**F5.2 — `feat/backend-incidents-crud`** — Full CRUD (create/paginated and server-side filtered list/get/update/changeStatus/delete). Docs: `requirements.md §1.2, §2 (performance)`. Commit: `feat(backend): add full incidents CRUD with server-side pagination`

**F5.3 — `feat/backend-trash-restore`** — Real trash on `deleted`. Docs: `requirements.md §1.2`. Commit: `feat(backend): add soft-delete trash and restore endpoints`

**F5.4 — `feat/backend-approval-flow`** — Approve/reject endpoints on `approval`. Docs: `requirements.md §1.2`. Commit: `feat(backend): add incident approval workflow`

**F5.5 — `feat/backend-media-s3`** — `MediaModule` + S3, presigned PUT, cascade delete. Docs: `requirements.md §1.7`, `aws-deploy-guide.md §Configurar el bucket S3`. Commit: `feat(backend): add S3-backed media uploads with presigned URLs`

**F5.6 — `feat/backend-tags-audit`** — Hierarchical `TagsModule` + audit interceptor over create/update/delete/status-change/approval. Docs: `requirements.md §1.8`. Commit: `feat(backend): add hierarchical tags and audit log interceptor`

---

## Phase 6 — First AWS deployment _(complete)_

**F6.1 — AWS account bootstrap** _(manual work by the user, guided end-to-end by `aws-deploy-guide.md` up through "install CLIs")_ — account, billing alarm, IAM user, AWS CLI + SAM CLI. No code commit.

**F6.2 — `chore/backend-first-sam-deploy`** — First `sam deploy --guided`; environment variables/secrets (Railway connection string, JWT secret); verify `/health` on the real API Gateway URL. Docs: `aws-deploy-guide.md §Primer despliegue con sam deploy --guided` (includes the `NoEcho` environment/secret parameters). Commit: `chore(backend): first guided SAM deployment to AWS dev stage`

**F6.3 — `fix/backend-cors-prod-readiness`** — CORS restricted to the Vercel domain, `helmet`, global `ThrottlerGuard` (`@nestjs/throttler`, complements the login-specific rate limiting already added in F4.3), structured logging, CloudWatch retention (14 days). Docs: `best-practices.md §Security, §AWS SAM/CI-CD`. Commit: `fix(backend): configure CORS, security headers, global rate limiting and log retention for prod`

**F6.4 — `ci/backend-deploy-pipeline`** — `backend-deploy.yml`: build/push to ECR, automatic `sam deploy` on push to `main`. Docs: `aws-deploy-guide.md §Configurar secrets de GitHub Actions`. Commit: `ci(backend): automate ECR build/push and SAM deploy on main`

---

## Phase 7 — Real frontend↔backend integration (MVP close-out) _(complete)_

**F7.1 — `feat/frontend-real-auth`** — `auth.service.ts` calls the real backend; access token in memory, refresh in an `httpOnly` cookie; `middleware.ts` validates expiration/signature. Docs: `requirements.md §1.1`. Commit: `feat(frontend): connect login and route guard to the real auth API`

**F7.2 — `feat/frontend-incidents-api`** — `incidents.service.ts` consumes the real `/incidents`; `useIssuesStore` gains `updateIncident`/`removeIncident`. Commit: `feat(frontend): consume real incidents API instead of the static mock`

**F7.3 — `feat/frontend-real-uploads`** — Presigned URL flow + direct PUT to S3 from `FileUploader`. Commit: `feat(frontend): upload attachments directly to S3 via presigned URLs`

**F7.4 — `feat/frontend-multitenancy-real`** — Real organization reflected across the whole UI (project name no longer hardcoded). Commit: `feat(frontend): reflect real tenant scoping across dashboard and map`

**F7.5 — `ci/e2e-backend-integration`** — Ephemeral `postgres:16` service in CI, real backend (Docker image) + frontend in the same job, Playwright against a real `baseURL`. Docs: `best-practices.md §Testing`. Commit: `ci: run e2e suite against a real backend with an ephemeral test database`

---

## Phase 8 — Extended product _(complete)_

| #    | Branch                            | Goal                                                                                                                                              | Suggested commit                                                       |
| ---- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| 8.1  | `feat/page-historial`             | `/historial` page over the audit log                                                                                                              | `feat(frontend): add real incident history page backed by audit log`   |
| 8.2  | `feat/page-trash`                 | Trash UI (list/restore)                                                                                                                           | `feat(frontend): add trash view with restore action`                   |
| 8.3  | `feat/approval-ui`                | Approval UI (badge + role-gated approve/reject)                                                                                                   | `feat(frontend): add incident approval flow UI`                        |
| 8.4  | `feat/page-gallery`               | `/galeria` page with media from every incident                                                                                                    | `feat(frontend): add media gallery page`                               |
| 8.5  | `feat/page-documents`             | `/documentos` page (document-type media)                                                                                                          | `feat(frontend): add documents page`                                   |
| 8.6  | `feat/page-calendar-full`         | Full calendar view (not just the widget)                                                                                                          | `feat(frontend): add full calendar view page`                          |
| 8.7  | `feat/notifications-inapp`        | In-app notifications (backend + TopBar bell)                                                                                                      | `feat: add in-app notifications (assignment, status change, approval)` |
| 8.8  | `feat/page-settings`              | Real settings: profile, password change                                                                                                           | `feat(frontend): add real settings page (profile, password change)`    |
| 8.9  | `feat/share-invite-collaborators` | "Share" → invite collaborators to project/org                                                                                                     | `feat: add project/organization collaborator invitations`              |
| 8.10 | `feat/reports-export`             | CSV export (incidents/dashboard) with an "Export and connect" option (data URL for Power BI/Looker Studio, `requirements.md §1.10`); evaluate PDF | `feat: add CSV export for filtered incidents and dashboard metrics`    |
| 8.11 | `feat/project-plans-attachment`   | Attach/view project plans (image/PDF)                                                                                                             | `feat: add project plan attachments (image/PDF)`                       |

`feat/i18n-real` moved to Phase 2 (F2.7) for being a Must with no backend dependency. Every row consults `requirements.md` (the matching section) and, when it involves a new backend piece (8.1, 8.3, 8.7, 8.9), also `best-practices.md §NestJS`.

---

## Phase 9 — Final hardening and portfolio polish

**F9.1 — `feat/motion-microinteractions`** — Introduces `motion` (motion.dev): staggered entry of dashboard cards, hover on clickable cards/rows, enter/exit transitions on modals; `useReducedMotion()` respected everywhere. Docs: `requirements.md §1.11`, `best-practices.md §Motion / Animations`. Commit: `feat: add motion micro-interactions across dashboard and modals`

**F9.2 — `feat/seo-pass`** — Next.js metadata, `sitemap.xml`, `robots.txt`. Docs: `best-practices.md §SEO`. Commit: `feat: add SEO metadata, sitemap and robots.txt`

**F9.3 — `chore/observability-pass`** — Structured logging, CloudWatch alarms for 5xx errors. Commit: `chore(backend): add structured logging and basic CloudWatch alarms`

**F9.4 — `fix/security-owasp-pass`** — Full OWASP checklist (including validating F6.3's global rate limiting under load), `npm audit`, secrets review. Docs: `best-practices.md §Security`. Commit: `fix: address OWASP checklist findings across frontend and backend`

**F9.5 — `fix/performance-a11y-pass`** — Core Web Vitals, accessibility audit (axe) on Phase 8 pages. Commit: `fix: performance and accessibility pass across new pages`

**F9.6 — `docs/portfolio-readme-demo`** — Root README with demo links (Vercel + AWS API), screenshots, final architecture diagram. Commit: `docs: update root README with production links and architecture diagram`

---

## Risks and assumptions to watch during execution

- **API Gateway and ECR aren't _always free_**: 12 months from AWS account creation; Lambda is. Note the expiration date next to the account creation date in F6.1.
- **CloudWatch Logs without retention accumulates cost** even though ingestion's free tier is perpetual — retention set from F6.3.
- **Concurrent Postgres connections on Railway**: every Lambda cold start can open a new connection — low `connection_limit` in Prisma + `reservedConcurrentExecutions` in SAM as a hard ceiling.
- **CORS + cross-domain cookies** (Vercel↔API Gateway): `SameSite=None; Secure` and explicit origin, never `*` — risk of silent blocking if not configured from F6.3/F7.1.
- **Deployment secrets in GitHub Actions**: prefer a GitHub→AWS OIDC role over static IAM keys; both paths documented in `aws-deploy-guide.md`, with keys as the simpler fallback.
- **Time scope**: the full roadmap is ambitious for a non-commercial project. It's modular by phase — pausing reasonably after Phase 7 (MVP with a fully real backend) is a valid stopping point; Phases 8-9 are an optional increment.

---

## Traceability: requirement → phase that delivers it

An inverse reading of the `Docs: requirements.md §X` citations already scattered per task above — useful for spotting at a glance whether a requirement was left without an assigned task. `§1.12` had none until this revision (closed with F2.8).

| §     | Area                             | Phase(s) / task(s)                                                                                                |
| ----- | -------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| §1.1  | Authentication and authorization | F4.1, F7.1 · password change in F8.8                                                                              |
| §1.2  | Incident management              | F1.3, F2.3, F2.4 (frontend) · F5.2, F5.3, F5.4, F7.2 (backend) · F8.2, F8.3, F8.11                                |
| §1.3  | Map                              | F2.5, F2.6                                                                                                        |
| §1.4  | Dashboard / analytics            | F2.1 (filter fix), F3.3 + F4.2 (real scoping)                                                                     |
| §1.5  | Collaboration and notifications  | F8.7 (notifications), F8.9 (invite collaborators)                                                                 |
| §1.6  | Multi-tenancy / organizations    | F3.3, F4.2, F7.4                                                                                                  |
| §1.7  | Files and media                  | F5.5, F7.3 · gallery/documents in F8.4, F8.5                                                                      |
| §1.8  | History / audit                  | F5.6, F8.1                                                                                                        |
| §1.9  | Internationalization             | F2.7                                                                                                              |
| §1.10 | Reporting and export             | F8.10                                                                                                             |
| §1.11 | Motion / animations              | F9.1                                                                                                              |
| §1.12 | Responsive / multi-device design | F2.8 · final pass in F9.5                                                                                         |
| §2    | Non-functional                   | F6.3 (security/CORS), F7.5 (e2e testing), F9.2 (SEO), F9.3 (observability), F9.4 (OWASP), F9.5 (performance/a11y) |
