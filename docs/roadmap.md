# Iteration Roadmap — FlyWorkFlow

> Planning document, versioned alongside the code. Last updated: 2026-09-07.
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

**F9.1 — `feat/motion-microinteractions`** _(complete)_ — Introduces `motion` (motion.dev): staggered entry of dashboard cards, hover on clickable cards/rows, enter/exit transitions on modals; `useReducedMotion()` respected everywhere. Docs: `requirements.md §1.11`, `best-practices.md §Motion / Animations`. Commit: `feat: add motion micro-interactions across dashboard and modals`

**F9.2 — `feat/seo-pass`** _(complete)_ — Next.js metadata, `sitemap.xml`, `robots.txt`. Docs: `best-practices.md §SEO`. Commit: `feat: add SEO metadata, sitemap and robots.txt`
Delivered deny-by-default indexing: the policy (public routes, robots directives, OG card, title template) lives in `src/lib/site.ts`, consumed by `app/robots.ts`, `app/sitemap.ts` and each route group's layout. `/login` is the only indexable route; `/invitar/[token]` is `noarchive` because the token is a credential. Two things the pass surfaced: `middleware.ts` was redirecting `/robots.txt` and `/sitemap.xml` to `/login` (both unreadable by crawlers — matcher now excludes them), and a nested `openGraph` block replaces rather than merges the parent's file-convention image, so `OG_IMAGE` is restated wherever `openGraph` is declared.

**F9.3 — `chore/observability-pass`** _(complete)_ — Structured logging, CloudWatch alarms for 5xx errors. Docs: `best-practices.md §Observability`. Commit: `chore(backend): add structured logging and basic CloudWatch alarms`
F6.3 had already given production a `JsonLogger`; what was missing was anything to put in it. Added a request-context middleware (correlation id from API Gateway's own request id, echoed as `x-request-id`), an interceptor that logs one line per successful request, and a global `AllExceptionsFilter` that logs the failures — split that way because a guard rejection (401/403/429) never reaches an interceptor, so the filter is the only place that sees every failed request. `JsonLogger` now flattens an object message into the entry, which is what makes `filter statusCode >= 500` work in Logs Insights. Three alarms in `template.yaml`, one per failure surface that can't see the others: Lambda `Errors` (crash/timeout/OOM — nothing was logged because nothing ran), API Gateway `5xx` (what the client got), and a metric filter over the app's own JSON logs (a handled 500, with a route and a request id already attached). Two things worth carrying forward: a 500 handled by the filter is a _successful_ Lambda invocation, so the Lambda `Errors` alarm alone would never have fired for it; and the log line deliberately records the parameterized route (`/invitations/:token`), never the URL — logging the concrete path would persist an invitation token to CloudWatch for the full retention window, the same credential F9.2 was careful about on the frontend. `AlarmEmail` is optional by design: unset, the alarms still exist and still change state, only the notification is skipped.

**F9.4 — `fix/security-owasp-pass`** _(complete)_ — Full OWASP checklist (including validating F6.3's global rate limiting under load), `npm audit`, secrets review. Docs: `best-practices.md §Security`. Commit: `fix: address OWASP checklist findings across frontend and backend`

Secrets review came back clean: no `.env` or key material has ever been committed (checked across all history, not just the tip), and the S3 provider takes credentials from the instance role rather than config. The findings were elsewhere.

The one that mattered most was `fileUrl`. The two-step upload presigns a key, the browser PUTs to S3, and then the browser _tells the server which URL it wrote to_ — and nothing tied that value back to the key just signed. So it was a free-text field that gets rendered (`<img src>` in the gallery, `<a href>` in documents) and, on delete, parsed back into the S3 key to erase. Either half is enough on its own: a `javascript:` URL for stored XSS, or a URL naming another tenant's object for a delete that reaches across organizations. `resolveOwnKey` on `StorageProvider` now pins origin and key prefix, `publicUrlForKey` is what gets persisted (a matching origin still leaves the query and fragment attacker-chosen), and the delete path re-derives rather than trusting the stored row, since rows predating this could hold anything. Media and project plans had identical code; both were fixed. The e2e fixtures were building URLs the real presign flow could never have issued, which is exactly why nothing caught it earlier — they now derive from the resource id.

Four more, each a different OWASP category. **CSV injection** (§A03) in `toCsv`: a cell is data to this API and a formula to Excel, so an incident title of `=HYPERLINK(...)` fires on whatever machine opens the export — a trust boundary no amount of `orgId` scoping reaches, and one quoting doesn't help with because the parser strips quotes before evaluating. Leading `= + - @ TAB CR` are now apostrophe-prefixed. **Password change didn't end sessions** (§A07): a refresh token taken earlier kept minting access tokens for the rest of its seven-day TTL no matter how many times the password changed — which inverts the one action a user takes when they think someone is in their account. **Refresh-token reuse wasn't detected**: rotation alone means a thief who spends the token first just wins, and the real client's 401 is indistinguishable from an expiry; presenting an already-rotated token now revokes the whole family, on the reasoning that there is no way to tell the two parties apart. **Swagger was public in production** (§A05), and helmet's CSP had been off API-wide since F6.3 solely to keep its inline bootstrap script working — one decision, so `ENABLE_API_DOCS` now gates both, defaulting off in production and restoring the CSP there (surfaced as a SAM `EnableApiDocs` parameter, so turning the docs back on for the portfolio stays a deliberate choice with its cost written next to it, rather than a template edit).

The frontend had no security headers at all: `helmet` has covered the backend since F6.3, but the half that actually renders HTML and holds the session cookie was on browser defaults. `next.config.mjs` now sets the invariant ones and `middleware.ts` issues a per-request nonce CSP (`'strict-dynamic'`, no `'unsafe-inline'` on scripts). Two things that made this cheaper than expected and one that made it more interesting: `next/font/google` self-hosts, so no external font origin was needed; only `/login` fell out of static rendering (it reads `headers()` for the JSON-LD nonce). The interesting one — CVE-2026-44581 is an XSS in _exactly this mechanism_ on next@14, where a malformed inbound `Content-Security-Policy` request header reaches nonce derivation and gets reflected. The middleware overwrites that header on every matched request, which is the advisory's own documented workaround; there is an e2e case asserting an injected header is neither reflected nor honoured, because a later "only set it if absent" refactor would quietly reopen it. The access-token mirror cookie also gained `Secure` (conditionally — an unconditional one is silently dropped over the plain HTTP that local dev and CI run on).

Rate limiting under load turned out to be an infrastructure question, not a code one. `req.ip` is correct in Lambda (verified: `@codegenie/serverless-express` passes API Gateway's `sourceIp` through, so no `trust proxy` fix was needed), but `@nestjs/throttler` counts in each instance's own memory with no shared store — so the API's real ceiling was `APP_THROTTLE_LIMIT x concurrent instances`, which is to say unbounded. `ReservedConcurrentExecutions` (SAM `MaxConcurrency`, default 5) turns it back into a number, and closes the roadmap's own listed risk about Railway connections at the same time.

`npm audit` was missing from both pipelines despite `best-practices.md §Security` asking for it; both now have it. The backend went to zero. The frontend cleared five of ten highs, and the remaining five (postcss, glob, and next itself) all resolve only to next@16 — a framework major, not a patch, so its gate sits at `critical` with the reason written next to it rather than being red from birth. **Deliberately not fixed here**: that upgrade is its own iteration. The app is not exposed to most of what those advisories cover (no Server Actions, no rewrites, no i18n Pages Router, no custom server), and the one that does touch it is mitigated above.

**F9.5 — F9.4 follow-ups** _(complete)_ — Everything the OWASP pass listed as open when it closed: the dependency upgrade it deferred, the media-upload trust boundary it only half-closed, and the items it explicitly left as "decide this in writing". Eight branches, merged through `develop`.

**The upgrade (A1, C4).** next@14 → 16 and React 18 → 19. `npm audit` goes to zero and `ci.yml`'s gate drops from `critical` back to `high`, closing the asymmetry with `backend-ci.yml` that F9.4 introduced with a note saying to close it here. The five highs were all transitive under next@14 with no fix short of the major. Four things the migration actually cost, none of them the `headers()`/`cookies()` change that was expected to dominate: `cookies()` was already awaited everywhere, so only the login layout needed touching. `params` is a promise now in Client Components too, and the invitation page's hand-written `{ token: string }` type meant nothing failed to compile — `params.token` would simply have been `undefined` and every invitation link would have previewed as "not found", which is the kind of break a type annotation actively hides. next@16 builds with Turbopack, which does not resolve the webpack `@` alias inside SCSS, so 41 stylesheets broke at once; they now import through Sass load paths, which works under either bundler. And `eslint-plugin-react-hooks@6` brought three React Compiler rule families that fire twelve times on code predating them — the SSR hydration guard, modals resetting state on open, Zustand's own lazy store init. All read, none a defect, all left as warnings with the reasoning in `eslint.config.mjs`: rewriting nine components inside a framework upgrade would make that upgrade impossible to review or revert.

**Trust the object, not the client (A2-A4).** One change, because they were one hole. The two-step upload presigned a key, let the browser PUT, and then took the browser's word for everything about what had been written. The size cap was checked against the number in the _presign request_, so a caller could declare 1 KB and PUT gigabytes; `content-length` is now signed, which makes S3 enforce it. The cap was then selected by `dto.type`, which the client chose freely — declaring `video` bought an image the 200 MB ceiling — while `presignUpload` had been deriving the type server-side from the content type all along. And nothing ever asked S3 whether the PUT had happened, so a row could name a key holding nothing. `create` now HEADs the object and takes type, format and size from it; those three fields left both DTOs entirely. `content-type` deliberately stays _out_ of the signature — the S3 presigner marks it unsignable because browsers rewrite the header — which is precisely why the type has to be read back off the object rather than pinned on the way in.

Found while wiring the signature, and worth more than the finding that led to it: with the SDK's default checksum behaviour, presigning hoists an `x-amz-checksum-crc32` of the _empty_ body into the query string, where S3 applies it to whatever the browser later PUTs. Every real upload would have failed its integrity check. No e2e test performs a real PUT, which is exactly why it was invisible.

**Credentials (A5, A7, A11).** Throttling was per IP and per Lambda instance, so nothing anywhere counted failures against a single _account_ — a distributed attempt met no limit at all. Failed logins are now counted on the `User` row, in Postgres, the one counter in this stack every instance shares; ten failures lock the account for fifteen minutes and `/auth/login` answers 429 rather than 401, because the password may well be correct. The window is short and self-expiring on purpose: a lockout an attacker can trigger against a known address is itself a denial of service, so it has to bound the attack without handing over a new one. Next to it, a smaller thing with the same shape: an unknown email returned before any bcrypt work, so response time alone answered "does this account exist?" — the reconnaissance step before the attempt the lockout exists to stop. `RefreshToken.tokenHash` became `@unique`, which F9.4's reuse detection had been assuming without the database ever enforcing it. bcrypt's work factor, declared three times including a bare `10` in the seed, became one constant — left at 10 rather than the 12 that was suggested, on the measurement: ~220 ms per comparison versus ~780 ms, on a 512 MB Lambda with roughly a third of a vCPU, which puts 12 nearer 2-3 s on the login path. The constant says to raise it together with `MemorySize`, not alone.

**Infrastructure and reporting (A9, A10).** The media bucket had a public access block and a PUT CORS rule and nothing else; it now has SSE-S3 encryption, versioning (so the delete path is recoverable — the function's `S3CrudPolicy` cannot reach past a delete marker), and the lifecycle rules that keep versioning from meaning "grows forever". `GET /reports/dashboard-data` accepts its token in an `X-Data-Token` header as well as `?token=`, preferring the header, so a caller that can set one has somewhere better to put a credential than a URL that reaches access logs and browser history; the query form stays, because the feature exists so a URL can be pasted into Power BI or Looker Studio.

**Written down rather than patched (A6, A8).** Both in `best-practices.md §Security`, each with the conditions that would reverse it. The access-token mirror cookie stays readable by JavaScript: `httpOnly` is worth doing and buys less than it looks like, because a script that can run in this origin can call `/auth/refresh` anyway — the nonce CSP is the control that matters, and changing this means changing how the store bootstraps, not flipping a flag. Rate limiting stays in per-instance memory: the ceiling is known (`APP_THROTTLE_LIMIT × MaxConcurrency`) and a shared store costs either a DynamoDB round trip on every request or a Redis bill, to prevent a scraping nuisance. The case where it _was_ a security boundary — credential attacks — is closed from the other direction by the account lockout above.

**Correctness (B1).** Reported as a race where two concurrent creates get the same `sequenceId`; that part was already prevented by `@@unique([orgId, sequenceId])` plus a retry. What `count()` did break is the case where a row is ever missing: the count then points back at a number still in use, and since the candidate was a pure function of the count, every retry recomputed the same taken value — not a duplicate, a create that could never succeed. Numbers now come from the highest already issued. Exhausting the retries also rethrew the raw P2002 as a 500, which would have tripped the app-5xx alarm F9.3 added for real faults; it is a 409.

**Process (C1-C3).** The Playwright suite could only ever run in CI — since F7.5 it drives a real backend against a real database, and nothing in the repo stood either up. `docker-compose.yml` plus `npm run e2e:local` now does, using the same image and credentials as the CI service. Two things the first real run turned up, both of which would have hit the next person: the host port is 5433 rather than 5432, because a developer machine often already runs PostgreSQL there and the container still reports healthy while connections reach the other server; and `nest build` twice in a row produced an empty `dist`, because `deleteOutDir` wipes the output while `incremental` keeps a tsbuildinfo that survives the wipe — the second build hears "nothing changed" and emits no `main.js`, surfacing much later as `Cannot find module`. CI never saw either: a fresh runner has no local Postgres and no tsbuildinfo. Node versions across the three workflows are one variable now; `.claude/settings.json` is committed and the per-developer files next to it are ignored.

**Left open, deliberately, and where it is written down.** Uploaded media was not readable in a real deploy — closed in F9.6 below, which is why it ran before the performance pass rather than after. The twelve React Compiler warnings are the other open item, in `eslint.config.mjs`.

**F9.6 — `feat/media-signed-downloads`** _(complete)_ — The read path for uploaded media, plus the deploy step that was missing under it. Scheduled here, ahead of the performance pass, because two of the pages F9.7 audits are `/galeria` and `/documentos` and neither displayed anything in a real deploy: rows stored the bucket's canonical URL, nothing ever signed a GET, and the bucket's public access block answered 403. Measuring Core Web Vitals on a gallery whose images 403 would have measured the wrong page. The demo never showed it because the seeded media points at picsum.photos.

Reads are signed now, at the point they are returned rather than at the point they are stored: the row keeps the canonical URL (F9.4's property, and what each read re-derives its key from) and the response carries a short-lived presigned GET. A row whose stored URL does not resolve to this bucket is returned unsigned rather than reissued — signing it would be the service vouching for whatever a pre-F9.4 row happens to name. This is also where A9's `ContentDisposition: attachment` finally lands: documents are signed with it so a PDF downloads instead of rendering on the bucket's origin, while images and video stay inline because `<img>`/`<video>` need them to. It is a _response_ override carried inside the signature, so the server decides it — the PUT-time header alternative would have had to be sent back verbatim by the browser, which is why F9.5 could not do it.

Two things that shaped the design rather than following from it. The gallery renders through `next/image`, which caches by URL and fetches server-side, so a signature carrying a fresh `X-Amz-Date` per request would be a fresh cache key per request — every page view re-downloading and re-optimizing every photo, which is precisely the kind of thing F9.7 exists to catch. Signatures are therefore generated against a rounded time window, so repeated requests inside one window produce byte-identical URLs. And `next/image` refuses a remote host absent from `remotePatterns`, so the bucket host is now a build-time env var (`NEXT_PUBLIC_MEDIA_HOST`, surfaced as a new `MediaBucketHost` stack output) rather than a wildcard — widening the pattern to every S3 bucket on AWS would turn the image optimizer into an open proxy.

Found while checking whether F9.5 could even deploy: **`backend-deploy.yml` never ran migrations**, and the image cannot run them either — the Dockerfile's runtime stage copies `dist`, `node_modules` and `package.json`, so `prisma/migrations` is not in it. Every migration up to F9.5 had been applied by hand from a developer machine, which works until someone forgets. F9.5 is what made forgetting an outage rather than an untidiness: it adds columns to `User`, and the generated client selects every scalar field, so a new image against an un-migrated database answers P2022 to any query touching a user — login, `/users/me`, the JWT strategy. The step runs before `sam deploy`, deliberately: these migrations are additive, so the old image keeps serving against the new schema in the gap, whereas the reverse order _is_ the outage. A destructive migration would need expand/contract and must not simply be dropped into that step. Commit: `feat: serve uploaded media through short-lived signed URLs`

**F9.7 — `fix/performance-a11y-pass`** — Core Web Vitals, accessibility audit (axe) on Phase 8 pages. Also the home for the React Compiler warnings F9.5 left as warnings. Commit: `fix: performance and accessibility pass across new pages`

**F9.8 — `docs/portfolio-readme-demo`** — Root README with demo links (Vercel + AWS API), screenshots, final architecture diagram. Commit: `docs: update root README with production links and architecture diagram`

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

| §     | Area                             | Phase(s) / task(s)                                                                                                                                                                               |
| ----- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| §1.1  | Authentication and authorization | F4.1, F7.1 · password change in F8.8                                                                                                                                                             |
| §1.2  | Incident management              | F1.3, F2.3, F2.4 (frontend) · F5.2, F5.3, F5.4, F7.2 (backend) · F8.2, F8.3, F8.11                                                                                                               |
| §1.3  | Map                              | F2.5, F2.6                                                                                                                                                                                       |
| §1.4  | Dashboard / analytics            | F2.1 (filter fix), F3.3 + F4.2 (real scoping)                                                                                                                                                    |
| §1.5  | Collaboration and notifications  | F8.7 (notifications), F8.9 (invite collaborators)                                                                                                                                                |
| §1.6  | Multi-tenancy / organizations    | F3.3, F4.2, F7.4                                                                                                                                                                                 |
| §1.7  | Files and media                  | F5.5, F7.3 · gallery/documents in F8.4, F8.5                                                                                                                                                     |
| §1.8  | History / audit                  | F5.6, F8.1                                                                                                                                                                                       |
| §1.9  | Internationalization             | F2.7                                                                                                                                                                                             |
| §1.10 | Reporting and export             | F8.10                                                                                                                                                                                            |
| §1.11 | Motion / animations              | F9.1                                                                                                                                                                                             |
| §1.12 | Responsive / multi-device design | F2.8 · final pass in F9.6                                                                                                                                                                        |
| §2    | Non-functional                   | F6.3 (security/CORS), F7.5 (e2e testing), F9.2 (SEO), F9.3 (observability), F9.4 (OWASP), F9.5 (OWASP follow-ups + next@16), F9.6 (media read path + deploy migrations), F9.7 (performance/a11y) |
