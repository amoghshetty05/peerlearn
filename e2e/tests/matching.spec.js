// TC-23 (FR-05, FR-06, FR-07): a help request returns at most 5 Tutors who teach the subject,
// ranked by a score from 0 to 100 in descending order, each with bookable slots.
const { test, expect } = require('@playwright/test');
const { uid, createUser, createTutor, loginUI, searchTutors } = require('./helpers');

test('TC-23 ranked matches for a help request', async ({ page }) => {
  const subject = `e2e${uid()}`; // a subject only this test's Tutors teach
  const levels = ['Advanced', 'Advanced', 'Intermediate', 'Intermediate', 'Beginner', 'Beginner'];
  const tutors = [];
  for (const [i, level] of levels.entries()) {
    tutors.push(await createTutor(subject, level, i % 2 ? 3 : 1, '16:00', '17:00', `tutor${i}`));
  }
  const outsider = await createTutor(`other${uid()}`, 'Advanced', 1, '16:00', '17:00', 'outsider');
  const learner = await createUser('learner');

  await loginUI(page, learner.email);
  await searchTutors(page, subject);

  const cards = page.locator('li.match');
  await expect(cards).toHaveCount(5); // 6 Tutors teach it; only the best 5 are shown
  await expect(page.getByText(outsider.name)).toHaveCount(0); // a Tutor without the subject is excluded

  const scores = [];
  for (const ring of await page.getByRole('img', { name: /Match score \d+ out of 100/ }).all()) {
    scores.push(Number((await ring.getAttribute('aria-label')).match(/\d+/)[0]));
  }
  expect(scores).toHaveLength(5);
  expect(scores.every((s) => s >= 0 && s <= 100)).toBe(true);
  expect([...scores].sort((a, b) => b - a)).toEqual(scores); // descending order
  await expect(cards.first().locator('button.chip.slot').first()).toBeVisible(); // slots to book
});
