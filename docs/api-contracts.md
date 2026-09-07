# API Contracts — FlyWorkFlow

> Reference document, versioned alongside the code. Last updated: 2026-08-20.
> This is the contract the backend implements — written before the code, not generated after. `@nestjs/swagger` produces browsable OpenAPI documentation from the same DTOs (`best-practices.md §Code Documentation`); that page is for exploring the API once it's built, but if it diverges from this document, this is where it's decided which of the two is out of date. Entities and fields in `data-model.md`, terms in `glossary.md`.

## Conventions

- **Auth**: `Authorization: Bearer <accessToken>` on every protected route, except `/auth/login` and `/auth/refresh`. The refresh token only travels via the `httpOnly` cookie, never in the body.
- **Scoping**: no protected route receives `orgId` as a parameter — it always comes from the JWT. An `orgId` in the body or URL is ignored or rejected, never used to decide what data to return.
- **Pagination**: `?page=1&pageSize=20` (default `pageSize=20`, max `100`); response `{ items: [...], total, page, pageSize }`.
- **Errors**: NestJS's standard shape — `{ statusCode, message, error }`. `message` is a string or an array of strings (`class-validator` validation errors, one per field).
- **Codes used consistently**: `400` invalid payload, `401` no session or expired token, `403` valid session without permission for this action, `404` the resource doesn't exist _or_ belongs to another organization (same code for both cases — never reveals that the resource exists in another tenant), `409` state conflict (e.g. closing an already-closed incident), `429` rate limit.

---

## Auth (`requirements.md §1.1`)

| Method and route       | Auth                  | Request                            | Response                                                  | Errors                                                                                                                  |
| ---------------------- | --------------------- | ---------------------------------- | --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `POST /auth/login`     | public                | `{ email, password }`              | `200 { accessToken }` + `Set-Cookie refreshToken`         | `401` invalid credentials · `429` strict per-IP rate limit, or the account locked after too many failed attempts (F9.5) |
| `POST /auth/refresh`   | `refreshToken` cookie | —                                  | `200 { accessToken }` + rotated `Set-Cookie refreshToken` | `401` cookie missing, expired or revoked                                                                                |
| `POST /auth/logout`    | Bearer                | —                                  | `204` — revokes the refresh token in the DB               | `401`                                                                                                                   |
| `PATCH /auth/password` | Bearer                | `{ currentPassword, newPassword }` | `204`                                                     | `400` weak password · `401` wrong current password                                                                      |

## Incidents (`requirements.md §1.2`)

| Method and route                | Auth                                  | Request                                                                                 | Response                                     | Errors                                                 |
| ------------------------------- | ------------------------------------- | --------------------------------------------------------------------------------------- | -------------------------------------------- | ------------------------------------------------------ |
| `GET /incidents`                | Bearer                                | query: `page, pageSize, status[], priority[], typeKey[], companyId[], dateFrom, dateTo` | `200` a page of incidents, scoped by `orgId` | `400` invalid filters                                  |
| `POST /incidents`               | Bearer                                | `CreateIncidentDto` (no `owner`/`orgId` — come from the JWT)                            | `201` incident created                       | `400` validation                                       |
| `GET /incidents/:id`            | Bearer                                | —                                                                                       | `200` detail                                 | `404` doesn't exist or belongs to another organization |
| `PATCH /incidents/:id`          | Bearer, author/assignee/admin         | partial editable fields                                                                 | `200` updated                                | `403` no permission · `404`                            |
| `PATCH /incidents/:id/status`   | Bearer, author/assignee/admin         | `{ status }`                                                                            | `200`                                        | `409` invalid transition                               |
| `PATCH /incidents/:id/approval` | Bearer, role with approval permission | `{ decision: 'approved' \| 'rejected', reason? }`                                       | `200`                                        | `403` no permission                                    |
| `DELETE /incidents/:id`         | Bearer, author/admin                  | —                                                                                       | `204` — soft delete (`deleted = true`)       | `403` · `404`                                          |
| `GET /incidents/trash`          | Bearer, admin                         | query: `page, pageSize`                                                                 | `200` a page of soft-deleted incidents       | `403` no permission                                    |
| `POST /incidents/:id/restore`   | Bearer, admin                         | —                                                                                       | `200` restored                               | `404` not in trash                                     |

## Incident types

Added in Phase 7 (F7.2): the frontend has no other way to discover the `typeId` UUIDs `POST /incidents` requires.

| Method and route      | Auth   | Request | Response                                                                      | Errors |
| --------------------- | ------ | ------- | ----------------------------------------------------------------------------- | ------ |
| `GET /incident-types` | Bearer | —       | `200` the shared 15-row catalog (`{id, key, name, nameEn}[]`), not org-scoped | —      |

## Media (`requirements.md §1.7`)

| Method and route            | Auth   | Request                                       | Response                                                                                                                                                                                                                                                         | Errors                                                                           |
| --------------------------- | ------ | --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `GET /media`                | Bearer | query: `page, pageSize, type[]`               | `200` a page of media across every non-deleted incident, scoped by `orgId`, each item carrying a lightweight incident ref (`{id, sequenceId, title, project}`) — backs the `/galeria` (image/video, roadmap 8.4) and `/documentos` (document, roadmap 8.5) pages | —                                                                                |
| `POST /media/presign`       | Bearer | `{ incidentId, filename, contentType, size }` | `200 { uploadUrl, fileUrl }` — single-use URL                                                                                                                                                                                                                    | `400` disallowed type or size                                                    |
| `POST /incidents/:id/media` | Bearer | `{ fileUrl, name }`                           | `201` media record created — `type`, `format` and `size` in the response are read off the stored object (F9.5), not sent by the client                                                                                                                           | `400` nothing uploaded at that URL, or the object's real type/size is disallowed |

The two-step upload is deliberately asymmetric about trust (F9.4, F9.5). `size` on `POST /media/presign` is not just validated against the type's cap — it goes into the presigned URL's signature as `content-length`, so S3 itself refuses a PUT of any other length and the cap binds the upload rather than the claim. `contentType` cannot be pinned the same way (the S3 presigner marks `content-type` unsignable because browsers rewrite it), so `POST /incidents/:id/media` HEADs the object and takes the type, format and byte length from what is actually in the bucket. That is also what makes "no file was ever uploaded to that URL" a `400` instead of a row pointing at nothing. `POST /projects/:id/plans` works the same way.

## Organizations / Projects (`requirements.md §1.6`)

| Method and route                 | Auth           | Request    | Response                                               | Errors                   |
| -------------------------------- | -------------- | ---------- | ------------------------------------------------------ | ------------------------ |
| `GET /users/me`                  | Bearer         | —          | `200` profile + `orgId` + `role`                       | `401`                    |
| `GET /organizations/:id/members` | Bearer         | —          | `200` member list (own organization unless superadmin) | `404` other organization |
| `GET /projects`                  | Bearer         | —          | `200` the organization's projects                      | —                        |
| `POST /projects`                 | Bearer, admin+ | `{ name }` | `201`                                                  | `403`                    |

## Project plans (`requirements.md §1.2` Could, roadmap 8.11)

Functional reinterpretation of the map toolbar's decorative "BIM Plans" button — real image/PDF attachments on a `Project`, not a native BIM/IFC viewer (explicitly Won't v1). Mirrors the `Media`/presigned-upload flow but scoped to `Project` instead of `Incident`, with a narrower content-type allowlist (image or `application/pdf` only, 20MB cap). Viewing is open to any org member (matches `GET /projects`); attaching/deleting is admin+ (matches `POST /projects`).

| Method and route                   | Auth           | Request                           | Response                                                                      | Errors                                                                           |
| ---------------------------------- | -------------- | --------------------------------- | ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `GET /projects/:id/plans`          | Bearer         | —                                 | `200` the project's plans, newest first                                       | `404` other organization                                                         |
| `POST /projects/:id/plans/presign` | Bearer, admin+ | `{ filename, contentType, size }` | `200 { uploadUrl, fileUrl }` — single-use URL                                 | `400` disallowed type or size · `403` · `404`                                    |
| `POST /projects/:id/plans`         | Bearer, admin+ | `{ fileUrl, name }`               | `201` plan record created — `type`/`format`/`size` read off the object (F9.5) | `400` nothing uploaded at that URL, or disallowed real type/size · `403` · `404` |
| `DELETE /plans/:id`                | Bearer, admin+ | —                                 | `204` — removes the S3 object too                                             | `403` · `404`                                                                    |

## Notifications (`requirements.md §1.5`)

| Method and route                | Auth                              | Request                                   | Response                      | Errors        |
| ------------------------------- | --------------------------------- | ----------------------------------------- | ----------------------------- | ------------- |
| `GET /notifications`            | Bearer                            | query: `since?` (for incremental polling) | `200` list, most recent first | —             |
| `PATCH /notifications/:id/read` | Bearer, owner of the notification | —                                         | `204`                         | `403` · `404` |

## Invitations (`requirements.md §1.5`)

Functional reinterpretation of the map toolbar's decorative "Share" button (roadmap 8.9). No `ProjectMember` model exists (a `User` belongs to exactly one `Organization`, and `Project` access is implicit at the org level), so an invitation is org-scoped only. `POST /invitations` returns the raw token embedded in `inviteUrl` exactly once — only its hash (`Invitation.tokenHash`) is persisted, so it can never be recovered afterward; the admin is expected to copy and share that link manually (no email is sent).

| Method and route                        | Auth           | Request                               | Response                                                                              | Errors                                                                                    |
| --------------------------------------- | -------------- | ------------------------------------- | ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `POST /invitations`                     | Bearer, admin+ | `{ email, role?: 'member'\|'admin' }` | `201` invitation + `inviteUrl` (raw token, shown once)                                | `400` invalid email · `403` · `409` email already a user                                  |
| `GET /invitations`                      | Bearer, admin+ | —                                     | `200` the organization's invitations, most recent first (no `inviteUrl`)              | `403`                                                                                     |
| `DELETE /invitations/:id`               | Bearer, admin+ | —                                     | `204` — revokes a pending invitation                                                  | `403` · `404` · `409` already accepted                                                    |
| `GET /invitations/token/:token`         | public         | —                                     | `200 { email, role, orgName, expiresAt }` — backs the `/invitar/:token` page          | `404` unknown token · `410` expired/revoked/accepted                                      |
| `POST /invitations/token/:token/accept` | public         | `{ name, password }`                  | `200 { accessToken }` + `Set-Cookie refreshToken` — creates the account, auto-logs in | `400` weak password · `404` · `409` email already a user · `410` expired/revoked/accepted |

## Audit / History (`requirements.md §1.8`)

| Method and route | Auth           | Request                            | Response                                                                                                                                                                                                       | Errors |
| ---------------- | -------------- | ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| `GET /audit-log` | Bearer, admin+ | query: `projectId?, userId?, page` | `200` a page of events, scoped by `orgId`; each entry includes `incident: { id, sequenceId, title, project }` alongside `actor` (F8.1 — the `/historial` page renders these without a per-row incident lookup) | `403`  |

## Reports (`requirements.md §1.10`, roadmap 8.10)

`GET /incidents/export.csv` is a manual, per-request CSV pull — same auth and same filter dimensions as `GET /incidents` (so it inherits that endpoint's pre-existing gap: no `createdByUser`/`responsibleUser` filtering, both dashboard-only client-side dimensions). `GET /reports/dashboard-data` is the "Export and connect" option: a stable URL meant to be pasted once into an external tool, so it can't depend on the 15-minute session JWT — it's gated by its own long-lived `ExportToken` instead (one per user, only its hash persisted — same convention as `Invitation.tokenHash`). Regenerating replaces the previous token and immediately invalidates any URL built from it.

That token travels either in an `X-Data-Token` request header or as `?token=`, and the header wins when both are sent (F9.5). `?token=` is what the UI hands out and is not going away — the feature exists so a URL can be pasted somewhere that accepts only a URL — but a credential in a URL reaches API Gateway access logs, browser history and `Referer` headers, which a request header does not. Any caller that can set a header should.

| Method and route              | Auth                     | Request                                                             | Response                                                                                                                                                                                | Errors                      |
| ----------------------------- | ------------------------ | ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| `GET /incidents/export.csv`   | Bearer                   | query: same filters as `GET /incidents` (no pagination)             | `200` streamed CSV, `Content-Disposition: attachment`                                                                                                                                   | `400` invalid filters       |
| `GET /reports/data-token`     | Bearer                   | —                                                                   | `200 { hasToken, createdAt }` — never the raw value                                                                                                                                     | `401`                       |
| `POST /reports/data-token`    | Bearer                   | —                                                                   | `200 { token, createdAt }` — raw token shown once; replaces any previous token for this user                                                                                            | `401`                       |
| `DELETE /reports/data-token`  | Bearer                   | —                                                                   | `204` — idempotent                                                                                                                                                                      | `401`                       |
| `GET /reports/dashboard-data` | data token (query param) | query: `token`, `status[], priority[], typeKey[], dateFrom, dateTo` | `200 JSON` — aggregated KPIs (counts by status/priority/type, overdue, avg. resolution, daily trend); meant for Power BI's "Web"/"From URL" connector or a Looker Studio JSON connector | `401` missing/invalid token |
