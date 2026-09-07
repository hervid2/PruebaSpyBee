# Data Model — FlyWorkFlow

> Reference document, versioned alongside the code. Last updated: 2026-08-20.
> Source of truth for entities until `backend/prisma/schema.prisma` exists (task F3.3 in `roadmap.md`) — from that point on, the real schema rules and this document updates to follow it, not the other way around. Undefined terms here are in `glossary.md`.

Entities marked **[frontend]** already exist today as TypeScript types in `src/domain/models/incident.model.ts` and are only migrated to Prisma. Entities marked **[new]** have no equivalent in the current frontend — they're born with the backend.

---

## Organization **[new]**

Root of multi-tenancy — everything else hangs off an organization.

| Field       | Type     | Notes                          |
| ----------- | -------- | ------------------------------ |
| `id`        | uuid     | PK                             |
| `name`      | string   | Visible name in TopBar/reports |
| `createdAt` | datetime |                                |

---

## User **[new]**

| Field                 | Type                                | Notes                                                                                   |
| --------------------- | ----------------------------------- | --------------------------------------------------------------------------------------- |
| `id`                  | uuid                                | PK                                                                                      |
| `orgId`               | uuid                                | FK → `Organization`                                                                     |
| `name`                | string                              |                                                                                         |
| `email`               | string                              | unique                                                                                  |
| `passwordHash`        | string                              | bcrypt — never a plaintext password                                                     |
| `role`                | enum(`member`,`admin`,`superadmin`) | `superadmin` is cross-org (§1.6 Should)                                                 |
| `avatarUrl`           | string?                             |                                                                                         |
| `createdAt`           | datetime                            |                                                                                         |
| `failedLoginAttempts` | int                                 | account-level brute-force counter (F9.5); reset on any successful login                 |
| `lockedUntil`         | datetime?                           | set when the counter reaches the threshold; `/auth/login` answers `429` until it passes |

`UserRef` (the lightweight shape already used in `incident.model.ts` for `owner`/`assignees`/`observers`: `{ id, name, email, avatarUrl? }`) is a projection of `User`, not its own entity — the backend assembles it when serializing, it isn't persisted separately.

---

## Project **[frontend → persisted]**

| Field       | Type     | Notes               |
| ----------- | -------- | ------------------- |
| `id`        | uuid     | PK                  |
| `orgId`     | uuid     | FK → `Organization` |
| `name`      | string   |                     |
| `createdAt` | datetime |                     |

---

## IncidentType **[frontend → persisted]**

A shared catalog, not organization-dependent — the 15 keys are the same for every tenant.

| Field    | Type   | Notes                                                          |
| -------- | ------ | -------------------------------------------------------------- |
| `id`     | uuid   | PK                                                             |
| `key`    | string | unique, e.g. `plumbing` — what `typeKey` references in filters |
| `name`   | string | Spanish display name                                           |
| `nameEn` | string | English name (i18n, §1.9)                                      |

---

## Incident **[frontend → persisted, with new fields]**

The central entity. Fields already typed in `incident.model.ts` are kept; the ones that today only exist in the mock JSON without a formal type are added, along with scoping/backend fields.

| Field                 | Type                                  | Notes                                                                                                                                            |
| --------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `id`                  | uuid                                  | PK                                                                                                                                               |
| `sequenceId`          | string                                | display code, e.g. `"0042"`                                                                                                                      |
| `orgId`               | uuid                                  | FK → `Organization` — denormalized onto the row itself so every listing query filters without an extra JOIN (§1.6 Must)                          |
| `projectId`           | uuid                                  | FK → `Project`                                                                                                                                   |
| `typeId`              | uuid                                  | FK → `IncidentType`                                                                                                                              |
| `title`               | string                                |                                                                                                                                                  |
| `description`         | string                                |                                                                                                                                                  |
| `priority`            | enum(`high`,`medium`,`low`)           | already typed in the frontend                                                                                                                    |
| `status`              | enum(`open`,`on_pause`,`closed`)      | already typed in the frontend                                                                                                                    |
| `approval`            | enum(`pending`,`approved`,`rejected`) | **changes from `boolean` to an enum** when the real workflow is built (§1.2 Should) — a boolean can't distinguish "not reviewed" from "rejected" |
| `ownerId`             | uuid                                  | FK → `User`                                                                                                                                      |
| `deleted`             | boolean                               | already typed in the frontend (`Incident.deleted`); formalized as a real column (§1.2 Should, trash)                                             |
| `coordinates`         | `{ lat, lng }`?                       | embedded, not a relation                                                                                                                         |
| `locationDescription` | string?                               |                                                                                                                                                  |
| `dueDate`             | datetime?                             |                                                                                                                                                  |
| `closingDate`         | datetime?                             |                                                                                                                                                  |
| `createdAt`           | datetime                              |                                                                                                                                                  |
| `updatedAt`           | datetime                              |                                                                                                                                                  |

**Many-to-many relationships**: `assignees` and `observers` (both against `User`) need their own join tables — `IncidentAssignee(incidentId, userId)` and `IncidentObserver(incidentId, userId)` — because a user can hold both roles on different incidents. `tags` uses `IncidentTag(incidentId, tagId)`.

---

## Tag **[frontend → persisted]**

| Field   | Type   | Notes                                                         |
| ------- | ------ | ------------------------------------------------------------- |
| `id`    | uuid   | PK                                                            |
| `orgId` | uuid   | FK → `Organization` — tags aren't shared across organizations |
| `name`  | string |                                                               |
| `color` | string | hex, already used for chips in the frontend                   |

---

## Media **[frontend → persisted]**

| Field        | Type                               | Notes                                            |
| ------------ | ---------------------------------- | ------------------------------------------------ |
| `id`         | uuid                               | PK                                               |
| `incidentId` | uuid                               | FK → `Incident`                                  |
| `name`       | string                             |                                                  |
| `type`       | enum(`image`,`video`,`document`)   | already typed in the frontend                    |
| `format`     | string                             | extension/mime                                   |
| `size`       | int                                | bytes — also validated server-side (§1.7 Should) |
| `status`     | enum(`uploaded`,`pending`,`error`) | already typed in the frontend                    |
| `url`        | string                             | S3 URL, never `blob:`                            |
| `createdAt`  | datetime                           |                                                  |

---

## ProjectPlan **[new]**

Project-level attachment (roadmap 8.11, `requirements.md §1.2` Could) — the functional reinterpretation of the map toolbar's decorative "BIM Plans" button: real image/PDF plans, not a native BIM/IFC viewer (explicitly Won't v1). Reuses `Media`'s `type` enum rather than a dedicated one, though only `image`/`document` are ever populated here.

| Field       | Type                             | Notes                                            |
| ----------- | -------------------------------- | ------------------------------------------------ |
| `id`        | uuid                             | PK                                               |
| `projectId` | uuid                             | FK → `Project`                                   |
| `name`      | string                           |                                                  |
| `type`      | enum(`image`,`video`,`document`) | only `image`/`document` allowed at the API layer |
| `format`    | string                           | extension/mime                                   |
| `size`      | int                              | bytes — also validated server-side, 20MB cap     |
| `url`       | string                           | S3 URL                                           |
| `createdAt` | datetime                         |                                                  |

---

## RefreshToken **[new]**

| Field       | Type      | Notes                                                                  |
| ----------- | --------- | ---------------------------------------------------------------------- |
| `id`        | uuid      | PK                                                                     |
| `userId`    | uuid      | FK → `User`                                                            |
| `tokenHash` | string    | unique (F9.5) — the token is never stored in clear text                |
| `expiresAt` | datetime  |                                                                        |
| `revokedAt` | datetime? | set on logout — the row isn't deleted, it stays as proof of revocation |
| `createdAt` | datetime  |                                                                        |

`tokenHash` is `@unique`, as it already was on `Invitation` and `ExportToken`. That is not only consistency: F9.4's refresh-token reuse detection assumes one raw token names exactly one row, and until F9.5 nothing in the database held that up — `AuthService.refresh` had to `findFirst` and would have picked one row out of any duplicates.

---

## AuditLog **[new]**

See the full flow in the target-architecture artifact — a NestJS interceptor writes here on every relevant mutation.

| Field        | Type                                                                                  | Notes                                                           |
| ------------ | ------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| `id`         | uuid                                                                                  | PK                                                              |
| `orgId`      | uuid                                                                                  | FK → `Organization`                                             |
| `incidentId` | uuid                                                                                  | FK → `Incident`                                                 |
| `actorId`    | uuid                                                                                  | FK → `User` — who made the change                               |
| `action`     | enum(`created`,`updated`,`status_changed`,`approved`,`rejected`,`deleted`,`restored`) |                                                                 |
| `metadata`   | jsonb                                                                                 | a minimal diff of the change (field, previous value, new value) |
| `createdAt`  | datetime                                                                              |                                                                 |

---

## Notification **[new]**

| Field         | Type                                           | Notes                                                                                                |
| ------------- | ---------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `id`          | uuid                                           | PK                                                                                                   |
| `orgId`       | uuid                                           | FK → `Organization`                                                                                  |
| `recipientId` | uuid                                           | FK → `User`                                                                                          |
| `incidentId`  | uuid                                           | FK → `Incident`                                                                                      |
| `type`        | enum(`assignment`,`status_changed`,`approval`) | a subset of `AuditLog.action` — not every mutation generates a notification, only these three (§1.5) |
| `readAt`      | datetime?                                      | `null` = unread                                                                                      |
| `createdAt`   | datetime                                       |                                                                                                      |

---

## Invitation **[new]**

Org-scoped collaborator invite (roadmap 8.9, `requirements.md §1.5`) — the functional reinterpretation of the map toolbar's decorative "Share" button. No `ProjectMember` model exists in this schema (a `User` belongs to exactly one `Organization`), so this is org-scoped only, not per-project.

| Field         | Type                                 | Notes                                                                                               |
| ------------- | ------------------------------------ | --------------------------------------------------------------------------------------------------- |
| `id`          | uuid                                 | PK                                                                                                  |
| `orgId`       | uuid                                 | FK → `Organization`                                                                                 |
| `email`       | string                               | the invitee's email — not yet a `User` row                                                          |
| `role`        | enum(`Role`), default `member`       | applied to the `User` created on acceptance; never `superadmin` (not exposed through this flow)     |
| `tokenHash`   | string, unique                       | sha256 digest of the raw token; the raw value is only ever returned once, in the create response    |
| `invitedById` | uuid                                 | FK → `User` — who sent it                                                                           |
| `status`      | enum(`pending`,`accepted`,`revoked`) | "expired" isn't a stored state — computed at read time from `expiresAt` instead of a background job |
| `expiresAt`   | datetime                             | 7 days from creation                                                                                |
| `createdAt`   | datetime                             |                                                                                                     |
| `acceptedAt`  | datetime?                            | set when the invitee completes `/invitar/:token`                                                    |

---

## ExportToken **[new]**

Long-lived, per-user token backing `GET /reports/dashboard-data` (roadmap 8.10, `requirements.md §1.10` — "Export and connect"). Deliberately distinct from the 15-minute session JWT: it's meant to be pasted once into an external tool (Power BI's Web connector, Looker Studio) as a stable URL. One row per user (`userId` unique); regenerating replaces it and immediately invalidates the previous URL.

| Field       | Type           | Notes                                                                                      |
| ----------- | -------------- | ------------------------------------------------------------------------------------------ |
| `id`        | uuid           | PK                                                                                         |
| `userId`    | uuid           | FK → `User`, unique — one token per user                                                   |
| `orgId`     | uuid           | FK → `Organization` — denormalized for a join-free lookup, same convention as `Invitation` |
| `tokenHash` | string, unique | sha256 digest of the raw token; the raw value is only ever returned once, on generation    |
| `createdAt` | datetime       |                                                                                            |

---

## Expected indexes (see `best-practices.md §Prisma / SQL`)

`Incident(orgId, status)`, `Incident(orgId, createdAt)`, `AuditLog(incidentId)`, `Notification(recipientId, readAt)` — the four combinations that `api-contracts.md`'s endpoints filter or sort on most often.
