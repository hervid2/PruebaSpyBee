/**
 * Reading `searchParams` in App Router pages.
 *
 * Since next@16 `searchParams` is a promise, and once awaited its values are
 * `string | string[] | undefined` — a query key can legitimately repeat
 * (`?page=2&page=3`). This module is the single place that narrows that
 * union, so the four paginated pages can't each invent their own rule.
 *
 * The typing matters as much as the parsing. F9.5 hit this exact class of bug
 * on the invitation page: a hand-written `{ token: string }` prop type meant
 * the promise change compiled clean and only failed at runtime. Pages now
 * take Next's *generated* `PageProps<'/route'>` instead of a local interface,
 * which is what makes forgetting the `await` a compile error rather than a
 * silently-`undefined` param — and it's why these helpers accept the raw
 * union that type produces rather than a tidied-up `string | undefined`.
 */

/**
 * First value of a possibly-repeated query param, or `undefined` when the
 * param is absent or empty. The app's own views build their URLs through
 * `URLSearchParams.set`, so a repeat only ever arrives from a hand-edited
 * address bar; taking the first value matches what the platform does
 * elsewhere rather than failing the whole request over it.
 */
export function firstParam(raw: string | string[] | undefined): string | undefined {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value === undefined || value === '' ? undefined : value;
}

/**
 * 1-based page number from a `?page=` param. Anything that isn't a positive
 * integer — absent, empty, `abc`, `0`, `-1`, `1.5` — falls back to page 1,
 * which is the value every paginated view already assumed it would get.
 */
export function parsePageParam(raw: string | string[] | undefined): number {
  const value = firstParam(raw);
  if (value === undefined) return 1;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}
