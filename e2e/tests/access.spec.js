// TC-22 (FR-02, SR-04, SR-05): every endpoint except register and login needs a token,
// and each role can use only its own endpoints.
const { test, expect } = require('@playwright/test');
const { apiContext, createUser } = require('./helpers');

test.describe('TC-22 Access control', () => {
  test('no token gets 401 and a wrong role gets 403', async () => {
    const anon = await apiContext();
    expect((await anon.get('/api/dashboard')).status()).toBe(401);

    const learner = await createUser('learner');
    const tutor = await createUser('tutor');
    expect((await learner.api.get('/api/admin/reports')).status()).toBe(403);
    expect((await tutor.api.get('/api/admin/reports')).status()).toBe(403);
    expect((await tutor.api.post('/api/requests', {
      data: { subject: 'maths', topic: 'x', preferredTime: new Date(Date.now() + 864e5).toISOString(), urgency: 'Low' },
    })).status()).toBe(403);
    expect((await learner.api.get('/api/dashboard')).status()).toBe(200);
  });

  test('a Learner does not see the Admin screen', async ({ page }) => {
    const learner = await createUser('learner');
    await page.goto('/login');
    await page.getByLabel('PES email').fill(learner.email);
    await page.getByLabel('Password').fill(learner.password);
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page.getByRole('navigation', { name: 'Main' }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: 'Reports' })).toHaveCount(0);
  });
});
