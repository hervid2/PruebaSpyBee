/**
 * Unit tests for `@/lib/search-params` — the narrowing rules the four
 * server-paginated pages share (`/galeria`, `/documentos`, `/historial`,
 * `/papelera`). The page-level plumbing that consumes these lives in
 * `__tests__/app/paginated-pages.test.tsx`.
 */
import { describe, it, expect } from 'vitest';
import { firstParam, parsePageParam } from '@/lib/search-params';

describe('firstParam', () => {
  it('passes a single value through', () => {
    expect(firstParam('proj-1')).toBe('proj-1');
  });

  it('takes the first value of a repeated param', () => {
    expect(firstParam(['proj-1', 'proj-2'])).toBe('proj-1');
  });

  it('treats absent and empty as undefined, so callers can omit the filter', () => {
    expect(firstParam(undefined)).toBeUndefined();
    expect(firstParam('')).toBeUndefined();
    expect(firstParam([])).toBeUndefined();
  });
});

describe('parsePageParam', () => {
  it('reads a positive integer page', () => {
    expect(parsePageParam('3')).toBe(3);
    expect(parsePageParam(['4'])).toBe(4);
  });

  it('falls back to page 1 when the param is absent or empty', () => {
    expect(parsePageParam(undefined)).toBe(1);
    expect(parsePageParam('')).toBe(1);
  });

  it.each(['abc', '0', '-1', '1.5', 'NaN', '1e3abc'])(
    'falls back to page 1 for the non-page value %j',
    (raw) => {
      expect(parsePageParam(raw)).toBe(1);
    },
  );
});
