// TC-27 (NFR-05, FR-13): on a 360-pixel-wide phone screen nothing scrolls sideways,
// the menu becomes a bottom tab bar, and booking a session takes at most 3 clicks from the dashboard.
const { test, expect } = require('@playwright/test');
const { uid, createUser, createTutor, loginUI, nextWeekdayLocal } = require('./helpers');

async function noSidewaysScroll(page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}

test('TC-27 phone layout and 3-click booking', async ({ page }) => {
  const subject = `e2e${uid()}`;
  const tutor = await createTutor(subject);
  const learner = await createUser('learner');
  await loginUI(page, learner.email);

  await expect(page.locator('nav.tabbar')).toBeVisible();
  await noSidewaysScroll(page);

  // click 1: Find a tutor
  await page.locator('main').getByRole('link', { name: 'Find a tutor' }).first().click();
  await page.getByLabel('Subject').fill(subject);
  await page.getByLabel('What do you need help with?').fill('Limits');
  await page.getByLabel('Preferred date and time (IST)').fill(nextWeekdayLocal(1, 16).local);
  await noSidewaysScroll(page);
  // click 2: Show matching tutors
  await page.getByRole('button', { name: 'Show matching tutors' }).click();
  await expect(page.locator('li.match')).toHaveCount(1);
  await noSidewaysScroll(page);
  // click 3: a time slot
  await page.locator('li.match').filter({ hasText: tutor.name }).locator('button.chip.slot').first().click();
  await expect(page.getByText(`Request sent to ${tutor.name}`)).toBeVisible();
});
