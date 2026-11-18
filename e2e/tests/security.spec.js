// TC-28 (SR-01, SR-02, SR-06): HTTPS only, safe response headers, no password hash in responses,
// and invalid or hostile input rejected with 400.
const { test, expect, request } = require('@playwright/test');
const { BASE_URL, apiContext, createUser } = require('./helpers');

test.describe('TC-28 Security checks through the browser-facing entry point', () => {
  test('plain HTTP is redirected to HTTPS (SR-01)', async () => {
    const httpUrl = process.env.HTTP_URL || BASE_URL.replace(/^https:/, 'http:');
    const ctx = await request.newContext({ ignoreHTTPSErrors: true });
    const res = await ctx.get(`${httpUrl}/login`, { maxRedirects: 0 });
    expect([301, 308]).toContain(res.status());
    expect(res.headers()['location']).toMatch(/^https:\/\//);
  });

  test('pages are sent with anti-framing headers', async ({ page }) => {
    const res = await page.goto('/login');
    expect(res.headers()['x-frame-options']).toBe('DENY');
  });

  test('no response contains a password hash (SR-02)', async () => {
    const u = await createUser('learner');
    const body = await (await u.api.get('/api/users/me')).text();
    expect(body).not.toMatch(/password|\$2[aby]\$/i);
  });

  test('injection and over-long input are rejected (SR-06)', async () => {
    const anon = await apiContext();
    const inj = await anon.post('/api/auth/login', { data: { email: "' OR '1'='1", password: "' OR '1'='1" } });
    expect([400, 401]).toContain(inj.status());
    expect(await inj.text()).not.toMatch(/token|syntax|SQL/i);

    const u = await createUser('learner');
    const long = await u.api.post('/api/requests', {
      data: { subject: 'maths', topic: 'x'.repeat(10_000), preferredTime: new Date(Date.now() + 864e5).toISOString(), urgency: 'Low' },
    });
    expect(long.status()).toBe(400);
    expect((await long.json()).code).toBe('VALIDATION_ERROR');
  });
});
