import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { createTestApp } from './utils/test-app';

/**
 * F9.4. `/api/docs` publishes the API's whole route inventory to anyone who
 * asks, and the only reason helmet's CSP was off for every response was to
 * keep that page's inline bootstrap script working (F6.3). The two are one
 * decision, so they are tested as one.
 */
describe('Security headers and API docs exposure (e2e)', () => {
  let app: INestApplication<App>;
  const originalFlag = process.env.ENABLE_API_DOCS;

  afterEach(async () => {
    await app.close();
    if (originalFlag === undefined) {
      delete process.env.ENABLE_API_DOCS;
    } else {
      process.env.ENABLE_API_DOCS = originalFlag;
    }
  });

  describe('with the docs disabled (the production default)', () => {
    beforeEach(async () => {
      process.env.ENABLE_API_DOCS = 'false';
      ({ app } = await createTestApp());
    });

    it('does not serve the OpenAPI docs page', async () => {
      await request(app.getHttpServer()).get('/api/docs').expect(404);
    });

    it('sends a content security policy on API responses', async () => {
      const res = await request(app.getHttpServer()).get('/health').expect(200);
      expect(res.headers['content-security-policy']).toContain(
        "default-src 'self'",
      );
    });

    it("keeps helmet's other headers, which never depended on the docs page", async () => {
      const res = await request(app.getHttpServer()).get('/health').expect(200);
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
      // Set by helmet but only honoured over HTTPS, which is what the real
      // API Gateway URL always is.
      expect(res.headers['strict-transport-security']).toContain('max-age=');
    });
  });

  describe('with the docs explicitly enabled', () => {
    beforeEach(async () => {
      process.env.ENABLE_API_DOCS = 'true';
      ({ app } = await createTestApp());
    });

    it('serves the docs page', async () => {
      await request(app.getHttpServer()).get('/api/docs').expect(200);
    });

    it('drops the CSP, which is the cost of turning them on', async () => {
      const res = await request(app.getHttpServer()).get('/health').expect(200);
      expect(res.headers['content-security-policy']).toBeUndefined();
    });
  });
});
