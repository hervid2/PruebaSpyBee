/**
 * Name of the cookie mirroring the in-memory access token. Non-`httpOnly` by
 * design: the browser-side auth store reads/writes it directly, the Edge
 * middleware verifies it on every navigation, and Server Components forward
 * it as the `Bearer` token for their initial data fetch. Shared here so all
 * three agree on the name.
 *
 * F9.5 reviewed that choice rather than inheriting it, and kept it — with the
 * reasoning and the conditions that would reverse it written down in
 * `docs/best-practices.md §Security`. Short version: only the first of those
 * three consumers actually needs JavaScript access, so this is buying one
 * saved `/auth/refresh` round trip per hard navigation at the price of a live
 * access token any injected script can read — but an injected script can also
 * just *call* `/auth/refresh`, since the browser attaches that cookie by
 * itself, so `httpOnly` here raises the cost of an XSS without closing it. The
 * controls that do are the nonce CSP in `middleware.ts` and the 15-minute
 * token TTL. Changing this is a change to how the store bootstraps, not a flag
 * flip; do it as its own piece of work.
 */
export const ACCESS_TOKEN_COOKIE = 'flyworkflow-access-token';
