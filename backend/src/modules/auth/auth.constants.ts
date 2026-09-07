/** Carries the opaque refresh token; scoped to `/auth` so no other route ever receives it. */
export const REFRESH_TOKEN_COOKIE = 'flyworkflow-refresh-token';
export const REFRESH_TOKEN_COOKIE_PATH = '/auth';

// Seconds, not a "15m"-style string: jsonwebtoken only type-checks the
// string form against a fixed literal union (`ms`'s `StringValue`), which a
// runtime env value can never satisfy — a plain number of seconds is always
// valid for `SignOptions.expiresIn`.
export const DEFAULT_ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
export const DEFAULT_REFRESH_TOKEN_TTL_DAYS = 7;

/** Strict, login-only limit (`requirements.md §1.1`), overriding the 'default' throttler below just for `/auth/login`. */
export const LOGIN_THROTTLE_LIMIT = 5;
export const LOGIN_THROTTLE_TTL_MS = 60_000;

/**
 * App-wide ceiling for every other route, applied via the global
 * `ThrottlerGuard` (F6.3). 20/60s (the original F6.3 value) turned out to be
 * tighter than a single legitimate session needs: the dashboard's own load
 * plus opening the create-incident modal (4 concurrent catalog calls) can
 * approach it on their own, and F7.5's real e2e suite proved it out — a
 * failed attempt's Playwright retries re-issue the same requests seconds
 * later in the same window, so retrying made it worse, not better. Raised to
 * comfortably absorb one user's normal interaction bursts while still
 * blocking sustained scraping/abuse.
 */
export const APP_THROTTLE_LIMIT = 100;
export const APP_THROTTLE_TTL_MS = 60_000;

/**
 * Account-level brute-force protection (F9.5). `LOGIN_THROTTLE_LIMIT` above
 * counts per IP, in each Lambda instance's own memory — so it never saw an
 * attempt spread across many addresses converging on one account, which is
 * the shape a real credential-stuffing run takes. These bound that instead:
 * failures are counted on the `User` row, in Postgres, which is the only
 * counter in this stack that is genuinely global.
 *
 * 10 rather than 5: this limit is reached by an attacker on their tenth guess
 * but by a real person who simply mistyped, so it sits above the range a
 * legitimate user reaches on a bad morning. The window is short and expires
 * on its own, because a lockout an attacker can trigger against a known email
 * is itself a denial of service against that user — 15 minutes bounds the
 * damage while still costing a distributed attempt three orders of magnitude
 * in throughput. Existing sessions are deliberately untouched: locking the
 * account is about the password, and cutting a signed-in user off is exactly
 * the outcome the attacker would be buying.
 */
export const ACCOUNT_LOCKOUT_THRESHOLD = 10;
export const ACCOUNT_LOCKOUT_WINDOW_MS = 15 * 60_000;
