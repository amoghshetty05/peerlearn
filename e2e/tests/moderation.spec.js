// TC-26 (FR-12): a Learner reports a Tutor, the Admin suspends the Tutor, and the Tutor can no longer log in.
const { test, expect } = require('@playwright/test');
const { createUser, loginUI } = require('./helpers');

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@pes.edu';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'ChangeMe-Admin-1';

test('TC-26 report, suspend, login refused', async ({ browser }) => {
  const tutor = await createUser('tutor', 'reported');
  const learner = await createUser('learner');

  const lc = await browser.newContext();
  const lp = await lc.newPage();
  await loginUI(lp, learner.email);
  await lp.goto(`/users/${tutor.id}`);
  await lp.getByRole('button', { name: 'Report' }).click();
  await lp.getByLabel('What happened?').fill('Did not turn up for the session and sent rude messages.');
  await lp.getByRole('button', { name: 'Send report' }).click();
  await expect(lp.getByText('Report sent to the moderators.')).toBeVisible();

  const ac = await browser.newContext();
  const ap = await ac.newPage();
  await loginUI(ap, ADMIN_EMAIL, ADMIN_PASSWORD);
  await ap.goto('/admin');
  const report = ap.locator('li, article, div.card').filter({ hasText: tutor.name }).last();
  await expect(report).toBeVisible();
  ap.once('dialog', (d) => d.accept());
  await report.getByRole('button', { name: 'Suspend' }).click();
  await expect(ap.getByText(`${tutor.name} was suspended.`)).toBeVisible();

  const tc = await browser.newContext();
  const tp = await tc.newPage();
  await tp.goto('/login');
  await tp.getByLabel('PES email').fill(tutor.email);
  await tp.getByLabel('Password').fill(tutor.password);
  await tp.getByRole('button', { name: 'Log in' }).click();
  await expect(tp.getByText(/suspended/i).first()).toBeVisible();

  for (const c of [lc, ac, tc]) await c.close();
});
