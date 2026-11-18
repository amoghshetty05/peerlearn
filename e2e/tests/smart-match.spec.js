// TC-30 (FR-16): Smart Match shows each matched Tutor's predicted chance of a successful session,
// produced by the model service (ml/), without changing the score order of FR-07.
const { test, expect } = require('@playwright/test');
const { uid, createUser, createTutor, loginUI, searchTutors } = require('./helpers');

test('TC-30 predicted success is shown for every match', async ({ page }) => {
  const subject = `e2e${uid()}`;
  await createTutor(subject, 'Advanced', 1, '16:00', '17:00', 'free');      // free at the asked time
  await createTutor(subject, 'Beginner', 3, '10:00', '11:00', 'elsewhere'); // free on another day
  const learner = await createUser('learner');

  await loginUI(page, learner.email);
  await searchTutors(page, subject);
  await expect(page.getByText(/Predicted success by Smart Match \(.+\)/)).toBeVisible();

  const cards = page.locator('li.match');
  await expect(cards).toHaveCount(2);
  const chances = [];
  for (const card of await cards.all()) {
    const text = await card.locator('.predict').innerText();
    chances.push(Number(text.match(/(\d+)%/)[1]));
  }
  chances.forEach((c) => expect(c).toBeGreaterThanOrEqual(0));
  chances.forEach((c) => expect(c).toBeLessThanOrEqual(100));
  expect(chances[0]).toBeGreaterThan(chances[1]); // the Tutor free at that time is more likely to succeed
});
