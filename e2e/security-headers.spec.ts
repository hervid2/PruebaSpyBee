/**
 * F9.4. The unit spec (`__tests__/app/security-headers.test.ts`) asserts the
 * policy string; this asserts that it — and the static headers from
 * `next.config.mjs` — actually reach a browser, and that the page still works
 * under it. A CSP that blocks the app's own bundle fails silently in the
 * console, so "no violations *and* the page hydrated" is the pair that matters.
 */
import { test, expect } from '@playwright/test';

test.describe('Security headers', () => {
  test('serves the full header set on a page response', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Headers do not vary by viewport — covered once.');

    const response = await page.goto('/login');
    const headers = response!.headers();

    expect(headers['x-content-type-options']).toBe('nosniff');
    expect(headers['x-frame-options']).toBe('DENY');
    expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
    expect(headers['permissions-policy']).toContain('geolocation=()');
    expect(headers['strict-transport-security']).toContain('max-age=');

    const csp = headers['content-security-policy'];
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toMatch(/script-src [^;]*'nonce-/);
    expect(csp).not.toContain("script-src 'self' 'unsafe-inline'");
  });

  test('issues a fresh nonce per request', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Not viewport-dependent — covered once.');

    const nonceOf = async () => {
      const res = await page.goto('/login');
      return /'nonce-([^']+)'/.exec(res!.headers()['content-security-policy'] ?? '')?.[1];
    };

    const first = await nonceOf();
    const second = await nonceOf();

    expect(first).toBeTruthy();
    // A nonce reused across responses is a constant, and a constant an
    // attacker can read from one page is no longer a secret on the next.
    expect(second).not.toBe(first);
  });

  test('ignores a Content-Security-Policy header sent by the client', async ({
    request,
    isMobile,
  }) => {
    test.skip(isMobile, 'Not viewport-dependent — covered once.');

    // CVE-2026-44581: on next@14 a malformed inbound CSP request header can
    // reach nonce derivation and be reflected into the rendered HTML, which a
    // shared cache then serves to everyone. middleware.ts overwrites that
    // header on every matched request, which is the advisory's own documented
    // workaround — this is the test that keeps it overwritten.
    const injected = `script-src 'nonce-x"><script>alert(1)</script>'`;
    const response = await request.get('/login', {
      headers: { 'Content-Security-Policy': injected },
    });

    const csp = response.headers()['content-security-policy'];
    expect(csp).toMatch(/script-src [^;]*'nonce-/);
    expect(csp).not.toContain('alert(1)');
    expect(await response.text()).not.toContain('alert(1)');
  });

  test('the login page runs and hydrates under the policy', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Not viewport-dependent — covered once.');

    const blocked: string[] = [];
    page.on('console', (msg) => {
      if (/Content Security Policy|Refused to/i.test(msg.text())) {
        blocked.push(msg.text());
      }
    });

    await page.goto('/login');

    // Toggling the password field is pure client-side React state: it only
    // works if the bundle loaded and hydration ran, which is exactly what a
    // too-strict `script-src` would have prevented.
    const password = page.locator('#password');
    await expect(password).toHaveAttribute('type', 'password');
    await page.getByLabel(/mostrar contraseña|show password/i).click();
    await expect(password).toHaveAttribute('type', 'text');

    expect(blocked).toEqual([]);
  });
});
