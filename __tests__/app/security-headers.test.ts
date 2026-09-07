/**
 * F9.4. The policy string is what stands between an injected `<script>` and
 * an executed one, and it is assembled from a handful of directives that are
 * easy to weaken by accident — so the directives that carry the weight are
 * asserted by name rather than left to a visual read of the module.
 */
import { describe, expect, it } from 'vitest';
import { buildContentSecurityPolicy } from '@/lib/security-headers';

/** Splits the header value back into `directive -> sources`. */
function parse(csp: string): Record<string, string[]> {
  return Object.fromEntries(
    csp.split('; ').map((part) => {
      const [directive, ...sources] = part.split(' ');
      return [directive, sources];
    }),
  );
}

describe('buildContentSecurityPolicy', () => {
  const prod = parse(buildContentSecurityPolicy('test-nonce', false));

  it('admits scripts only by this request’s nonce', () => {
    expect(prod['script-src']).toContain("'nonce-test-nonce'");
    // The point of the nonce is lost the moment either of these is present:
    // every injected inline script would run again.
    expect(prod['script-src']).not.toContain("'unsafe-inline'");
    expect(prod['script-src']).not.toContain("'unsafe-eval'");
  });

  it("propagates trust to the chunks Next's own scripts load", () => {
    // Without `strict-dynamic`, every dynamically imported chunk would need
    // to match a host source, and the App Router loads plenty of them.
    expect(prod['script-src']).toContain("'strict-dynamic'");
  });

  it('allows eval in development only, where Fast Refresh needs it', () => {
    const dev = parse(buildContentSecurityPolicy('test-nonce', true));
    expect(dev['script-src']).toContain("'unsafe-eval'");
  });

  it('refuses to be framed and pins where forms may post', () => {
    expect(prod['frame-ancestors']).toEqual(["'none'"]);
    // An injected form posting a typed password to another origin is the
    // thing this closes.
    expect(prod['form-action']).toEqual(["'self'"]);
    expect(prod['base-uri']).toEqual(["'self'"]);
    expect(prod['object-src']).toEqual(["'none'"]);
  });

  it('defaults to self, so a directive nobody thought of is not wide open', () => {
    expect(prod['default-src']).toEqual(["'self'"]);
  });

  it('reaches only our own API and Mapbox', () => {
    expect(prod['connect-src']).toContain("'self'");
    expect(prod['connect-src']).toContain('https://api.mapbox.com');
    expect(prod['connect-src']).toContain('https://events.mapbox.com');
  });

  it('permits the blob worker Mapbox GL builds its renderer in', () => {
    expect(prod['worker-src']).toContain('blob:');
    expect(prod['child-src']).toContain('blob:');
  });

  it('upgrades insecure subrequests in production only', () => {
    expect(prod).toHaveProperty('upgrade-insecure-requests');
    // In dev everything is plain HTTP; upgrading would break local assets.
    expect(parse(buildContentSecurityPolicy('n', true))).not.toHaveProperty(
      'upgrade-insecure-requests',
    );
  });
});
