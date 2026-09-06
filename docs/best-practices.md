# Best Practices — FlyWorkFlow

> Reference document, versioned alongside the code. Last updated: 2026-08-20.
> `roadmap.md` references specific sections of this document by title — read only the part the current iteration calls for, not top to bottom.

---

## Next.js / React

- **Server vs. Client Components by default**: every component is a Server Component unless it needs browser state, effects or events (`'use client'` explicit and as low in the tree as possible, never in `layout.tsx` if avoidable).
- **Semantic naming**: hooks start with `use` and describe the data they return, not the implementation (`useDashboardMetrics`, not `useMemoizedFilteredArray`). Components in `PascalCase` describing what they render, not where they live (`CriticalIssuesList`, not `DashboardTable3`).
- **One component, one responsibility**: if a component mixes fetching, metrics calculation and presentation, extract the calculation into a pure selector in `domain/selectors/` (the pattern already used in `dashboard-metrics.selector.ts`) and the fetching into a hook.
- **Derived state, not duplicated**: if a value can be computed from other state (`useMemo`), it isn't stored separately in the store — avoids drift.
- **Server Actions or Route Handlers** only if Next.js edge logic is genuinely needed; all real business logic lives in `backend/` (NestJS), not the frontend.
- **Absolute imports** with the already-configured `@/*` alias; never `../../../..`.
- **SCSS Modules with BEM** (an already established pattern): `.component__element--modifier`, one stylesheet per component, no global selectors outside `styles/base/`.

## Responsive / Adaptive Design

See `requirements.md §1.12` for the formal requirement — this section is the implementation "how".

- **The four `_variables.scss` breakpoints are the single source of truth** (`$breakpoint-mobile: 480px`, `$breakpoint-tablet: 768px`, `$breakpoint-desktop: 1280px`, `$breakpoint-wide: 1600px`) — no new component introduces a media query value different from those four.
- **Data tables follow the pattern already used in `CriticalIssuesList`**: `.tableWrapper { overflow-x: auto; }` as the acceptable floor on mobile, first evaluating whether a transformation into stacked cards or breakpoint-prioritized columns makes sense before accepting horizontal scroll as the final solution.
- **`min-width: 0` on flex/grid children that could overflow**: the same fix already applied reactively in `DashboardView` to stop Recharts from forcing horizontal overflow — apply it upfront in new layouts with charts or tables, not as a later patch.
- **Minimum 44×44px touch targets** on any clickable element visible on a mobile viewport (see also `§Accessibility`).
- **Modals with a max height and internal content scroll**, never the full document, so they fit small viewports without clipping edges or corners.

## i18n (next-intl)

- **Namespaces by domain/feature** (`dashboard`, `map`, `issues`, `auth`, …), never a single flat dictionary — avoids key collisions and makes it obvious where each text lives.
- **Server Components read messages with `next-intl`'s server utilities** (`getTranslations`); **Client Components use `useTranslations()`** — the two styles are never mixed within the same component.
- **No hardcoded literals** once the language switcher is real (`requirements.md §1.9`): every visible text —including Zod validation messages and the domain's status/priority labels— goes through a translation key.
- **Pluralization and date/number formatting via ICU message format** (native to `next-intl`), never manual string concatenation.
- **`es` as the explicit fallback locale**: a key missing in `en` should never be visible in production as a raw, untranslated key.

## Motion / Animations (React)

Library: **`motion`** (motion.dev, successor to Framer Motion). Adds motion on top of the already-existing interface — layout and palette aren't redesigned, see `requirements.md §1.11`.

- **`useReducedMotion()` first, always**: any animated component checks the hook before defining its variants; if the user has "reduce motion" enabled at the system level, the animation is replaced with a ~100ms cross-fade or skipped outright. This isn't optional (a Must requirement).
- **Reuse the transition tokens already defined** in `_variables.scss` (`$transition-fast: 0.15s`, `$transition-normal: 0.25s`) as the basis for Motion's durations, instead of inventing new values — keeps a single source of truth for "how fast the interface moves".
- **Where it fits**: staggered entry of cards/lists on mount (`staggerChildren`), `whileHover`/`whileTap` on clickable elements (1.02–1.03 scale, never more — an exaggerated hover feels like a bug), modal enter/exit transitions with `AnimatePresence`.
- **Where it doesn't**: don't animate Recharts' own chart rendering (it already has native animation — animating it twice looks choppy); don't animate on every re-render, only on real state transitions (mount, period change, open/close); never animate content critical to completing a task (a form shouldn't "dance" while the user types).
- **Isolate in Client Components**: like any interactivity, animation lives in components already identified as `'use client'` — it doesn't suddenly turn a Server Component into a client one just to decorate its container.

## TypeScript

- **`strict: true` with no exceptions** — don't add `// @ts-ignore` without a comment explaining why it's unavoidable.
- **Domain types as the source of truth**: any type representing a business entity (`Incident`, `Organization`, etc.) lives in `domain/models/` (frontend) or the Prisma schema (backend) — never hand-duplicated inside a component.
- **`type` vs `interface`**: `interface` for object shapes that can be extended (entities, props), `type` for unions, intersections and function aliases.
- **No implicit `any`**: if the true type is unknown at write time (an external response, `unknown`), use `unknown` and narrow with a type guard, never `any` as a shortcut.
- **Pure functions where possible**: if a function doesn't depend on I/O or external state, it should be testable without mocks — an existing example: `getDashboardMetrics`.
- **Identifiers always in English**: function, variable, type, file and git branch names in English, both frontend and backend — Spanish is reserved exclusively for visible UI copy (and its English counterpart via i18n, `requirements.md §1.9`). This also applies to commit messages (already English in the project) and to Prisma schema column/table names.

## Code Documentation

Code is documented minimally but professionally — it's not "no comments" flatly, it's documenting the _public surface_ and staying quiet about internal implementation when it's already readable on its own.

- **Exported functions/hooks/services carry TSDoc** (`/** ... */` with a one-line description, `@param`, `@returns` when not obvious from the type) — applies to anything another file imports: `domain/` selectors, `services/` services, `hooks/` hooks, and their equivalents in `backend/src/modules/*/**.service.ts`.
- **Internal/private code follows the project's general rule**: no comments unless they explain a non-obvious why (an external constraint, a specific workaround) — documenting _what_ a line does when the function name already says so is noise, not documentation.
- **HTTP API documented with `@nestjs/swagger`**: every controller and DTO carries the decorators (`@ApiTags`, `@ApiOperation`, `@ApiResponse`, `@ApiProperty`) needed for `/api/docs` to generate a browsable OpenAPI spec — it's the standard professional pattern for a NestJS REST API, and it also serves as living documentation for anyone reviewing the portfolio project without reading the code.
- **README per package**: `backend/README.md` documents how to run the backend locally, the same way the root `README.md` already documents the frontend.

## NestJS (backend)

- **One module = one responsibility**: `AuthModule`, `IncidentsModule`, `OrganizationsModule`, etc. — each with its own `*.module.ts`, `*.controller.ts`, `*.service.ts` and `dto/`. Never a monolithic `AppService`.
- **Real dependency injection**: services receive their dependencies through the constructor (`PrismaService`, other services), never instantiated with `new` inside another class — this is what makes the backend testable with real NestJS mocks (`@nestjs/testing`).
- **DTOs validated with `class-validator`** on every API input — never trust that the frontend already validated (Zod on the client is UX, not security).
- **Guards for authorization, not loose `if`s in the controller**: `JwtAuthGuard`, `RolesGuard`, `OrgScopeGuard` applied with decorators (`@UseGuards`, `@Roles(...)`) — the "who can do what" logic lives in one reusable place.
- **SOLID principles applied concretely**:
  - _S_ (single responsibility): a service shouldn't validate business rules, talk to Prisma, and build the HTTP response all at once — split into a service + output mapper/DTO if it grows.
  - _O_ (open/closed): new notification or export types get added by implementing a shared interface, not by modifying a giant existing `switch`.
  - _L_ (Liskov substitution): if a `StorageProvider` interface is defined (for S3), any alternative implementation must be able to replace it without breaking whoever consumes it.
  - _I_ (interface segregation): input DTOs specific to each use case (`CreateIncidentDto` ≠ `UpdateIncidentDto`), not a single giant DTO with every field optional.
  - _D_ (dependency inversion): domain modules depend on abstractions (`PrismaService`, storage interfaces), never import an AWS SDK client directly inside a business service — that lives in `lib/s3/`.
- **`main.ts` (local dev) separate from `lambda.ts` (Lambda handler)**: both share `AppModule`, but the dev bootstrap shouldn't be coupled to the serverless adapter.

## Prisma / SQL

- **Migrations always generated, never hand-edited** (`prisma migrate dev` locally, `prisma migrate deploy` in CI/production).
- **Explicit indexes** on every column used in high-traffic `WHERE`/`ORDER BY` clauses (`orgId`, `status`, `createdAt` on `Incident`).
- **Avoid N+1**: use Prisma's `include`/`select` to fetch relations in a single query instead of iterating and querying per row.
- **Low `connection_limit`** in the connection string (1–3) given Lambda's concurrency pattern against Railway's free plan.
- **Versioned seeds** (`prisma/seed.ts`) — never populate test data by hand in production or directly on Railway via console.

## Docker

- **Multi-stage build required**: an install/build stage with `devDependencies`, a minimal final stage with only what's needed to run (official Lambda Node.js base image) — reduces size and attack surface.
- **Complete `.dockerignore`**: `node_modules`, `.git`, test files, local `dist` — should never end up copied into the final image.
- **One image, two test contexts**: built once and validated both with the Lambda Runtime Interface Emulator locally and, later, on the actual deployed Lambda — never "works on my machine" without going through that emulator first.

## AWS SAM / CI-CD

- **`template.yaml` is the source of truth for infrastructure** — no resource is created by hand through the console except what the AWS guide explicitly marks as a one-time account step (IAM user, billing alarm).
- **Never secrets in the repo**: Railway connection string, JWT secret, AWS credentials — always as SAM `NoEcho` parameters or GitHub Secrets, never in `template.yaml` or a versioned `samconfig.toml`.
- **CI runs on every PR, deploy only on `main`**: a strict separation between "verify it builds and tests pass" (every PR) and "publish" (only after merging to `main`).
- **Each pipeline is scoped to its folder** (`paths: backend/**` vs. everything else) so the frontend CI doesn't re-run when only the backend changes, and vice versa.
- **Log retention explicitly configured** in CloudWatch (14 days) — a log group with no retention accumulates cost indefinitely even though ingestion's free tier is perpetual.

## Observability

- **One structured line per request, exactly one** — `HttpLoggingInterceptor` logs the successes, `AllExceptionsFilter` logs the failures, and neither logs what the other does. A guard rejection (401/403/429) never reaches an interceptor, which is why the failure line belongs to the filter and not to a `catchError` in the interceptor.
- **A correlation id on every response** (`x-request-id`, echoed back if the caller sent one, otherwise API Gateway's own id): Lambda only stamps its RequestId onto `console.*` output, so a logger writing straight to stdout has to carry its own — without it, the lines of one request can't be grouped in Logs Insights.
- **Log the route pattern, never the concrete URL or the body**: `/invitations/:token`, not `/invitations/<the actual token>`. Paths and bodies carry credentials, and CloudWatch keeps whatever it is given for the whole retention window.
- **A 5xx response body says nothing but the request id** — a Prisma error message names columns and queries. The stack goes to the log, the id goes to the user, and the two meet in Logs Insights. 4xx bodies pass through untouched: `class-validator`'s field messages are part of the contract the frontend renders.
- **Alarm on each failure surface separately**, because none of them sees the others: Lambda `Errors` (crash, timeout, OOM — nothing was logged because nothing ran), API Gateway `5xx` (what the client actually got), and a metric filter over the application's own JSON logs (a handled 500, already carrying a route and a request id). The first two are the safety net; only the third tells you where to look.
- **Alarms are template resources like any other** — `TreatMissingData: notBreaching` so an idle portfolio API doesn't sit in `INSUFFICIENT_DATA` and train you to ignore it.

## SEO

- **Next.js Metadata API** (`generateMetadata`) instead of manual `<head>`.
- **`robots.txt` + explicit `noindex` on authenticated routes**: the application is private behind login, so SEO only matters for `/login` and an eventual public landing page — indexing a user's dashboard would be a privacy mistake, not just an SEO one.
- **`sitemap.xml`** generated only for real public routes.
- **Core Web Vitals**: keep `next/image` for every remote image, code-splitting already in place (Mapbox, Recharts lazily loaded) as the standard for any new heavy library.

## Testing

- **Every code change ships its test in the same iteration** — never "we'll test it later" as a separate phase.
- **Vitest on the frontend, Jest on the backend** — each stack uses its idiomatic tool; don't force a single testing tool across the whole monorepo for superficial consistency.
- **Domain tests (selectors, services) are pure functions with no mocks** whenever possible; mocks are reserved for real boundaries (HTTP, database, S3).
- **E2E against a real backend** in CI (ephemeral Postgres as a job service), never just against mocks once the backend exists — an E2E suite that never touches the real API doesn't catch broken contracts.

## Accessibility

- Maintain and extend the level already reached in the current frontend (ARIA roles, `aria-live` on notifications, full keyboard navigation, visible focus) to every new roadmap page (History, Gallery, Documents, Calendar, Settings).
- Every interactive icon with no visible text carries an `aria-label` — the new FlyWorkFlow logo/mark is no exception when used as a button (e.g. "go to home").
- Minimum AA contrast on the gold/dark palette already in use, explicitly verified when introducing any new color (notification severity, approval states).
- Minimum 44×44px touch targets on mobile (`§Responsive / Adaptive Design`, `requirements.md §1.12`) — an interactive icon that looks fine on desktop shouldn't shrink its real hit area when scaled down to small viewports.

## Security (basic OWASP checklist for the API)

- Input validation at the edge (`class-validator` + global `ValidationPipe`).
- Always parameterized queries via Prisma — never raw interpolated SQL.
- Global rate limiting across the whole API (`@nestjs/throttler` as an application-level `ThrottlerGuard`), with an additional, stricter limit on `/auth/login` — protects both against credential brute-forcing and against scraping/abuse that could exhaust the free quota of Lambda invocations or Postgres connections on Railway.
- Security headers (`helmet`) and CORS with an explicit origin (never `*`) once the frontend consumes the real API.
- Passwords with bcrypt, never in plaintext or with a reversible hash.
- Refresh token in an `httpOnly`, `Secure`, `SameSite=None` cookie (cross-domain Vercel↔API Gateway).
- `npm audit` (or equivalent) as part of the CI pipeline, both in `frontend` and `backend`.
- Rotatable secrets, never committed — if one leaks by mistake, it gets rotated, never "well, it's already committed so never mind".
