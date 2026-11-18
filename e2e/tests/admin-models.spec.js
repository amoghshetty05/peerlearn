// TC-31 (FR-16, NFR-09): the Admin's Smart Match page lists the six models (2 machine learning,
// 2 deep learning, 2 quantum) and the rule-based baseline, with their scores and the model in use.
const { test, expect } = require('@playwright/test');
const { loginUI } = require('./helpers');

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@pes.edu';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'ChangeMe-Admin-1';

test('TC-31 Admin compares the six Smart Match models', async ({ page }) => {
  await loginUI(page, ADMIN_EMAIL, ADMIN_PASSWORD);
  await page.getByRole('link', { name: 'Smart Match' }).first().click();
  await expect(page.getByRole('heading', { name: 'Smart Match models' })).toBeVisible();

  const rows = page.locator('table.models tbody tr');
  await expect(rows).toHaveCount(7); // six models + the rule-based baseline
  const families = await rows.locator('td:first-child small').allInnerTexts();
  for (const family of ['Machine learning', 'Deep learning', 'Quantum']) {
    expect(families.filter((f) => f === family)).toHaveLength(2);
  }
  expect(families.filter((f) => f === 'Baseline')).toHaveLength(1);
  await expect(page.locator('.in-use')).toHaveCount(1);

  // every ROC-AUC is a real score between 0.5 and 1, and the models are listed best first
  const aucs = (await rows.locator('.auc b').allInnerTexts()).map(Number);
  aucs.forEach((a) => { expect(a).toBeGreaterThan(0.5); expect(a).toBeLessThanOrEqual(1); });
  const models = aucs.slice(0, 6);
  expect([...models].sort((a, b) => b - a)).toEqual(models);
  await expect(page.getByText(/simulated sessions/)).toBeVisible();
});

test('TC-31 a Learner cannot open the Smart Match models page', async ({ page }) => {
  const { createUser } = require('./helpers');
  const learner = await createUser('learner');
  await loginUI(page, learner.email);
  await expect(page.getByRole('link', { name: 'Smart Match' })).toHaveCount(0);
  await page.goto('/admin/models');
  await expect(page.getByRole('heading', { name: 'Smart Match models' })).toHaveCount(0);
});
