// TC-24 (FR-08, FR-11, FR-13, FR-14): Learner requests a slot, contact details stay hidden,
// Tutor accepts, then the Learner sees the contact details and a notification.
const { test, expect } = require('@playwright/test');
const { uid, createUser, createTutor, loginUI, searchTutors } = require('./helpers');

test('TC-24 book a session, accept it, reveal contact details', async ({ browser }) => {
  const subject = `e2e${uid()}`;
  const tutor = await createTutor(subject, 'Advanced', 1, '16:00', '17:00');
  const learner = await createUser('learner');

  const learnerCtx = await browser.newContext();
  const lp = await learnerCtx.newPage();
  await loginUI(lp, learner.email);
  await searchTutors(lp, subject);
  await lp.locator('li.match').filter({ hasText: tutor.name }).locator('button.chip.slot').first().click();
  await expect(lp.getByText(`Request sent to ${tutor.name}`)).toBeVisible();

  // Before acceptance the Tutor's email is not shown anywhere (FR-14)
  await lp.goto(`/users/${tutor.id}`);
  await expect(lp.getByText('Email and phone unlock once a tutor accepts')).toBeVisible();
  await expect(lp.getByText(tutor.email)).toHaveCount(0);

  // Tutor sees the request on the dashboard and accepts it (FR-08, FR-13)
  const tutorCtx = await browser.newContext();
  const tp = await tutorCtx.newPage();
  await loginUI(tp, tutor.email);
  await expect(tp.getByText(learner.name)).toBeVisible();
  await tp.getByRole('button', { name: 'Accept' }).first().click();
  await expect(tp.getByText('Accepted.').first()).toBeVisible();

  // Learner now sees the contact details and an alert (FR-11, FR-14)
  await lp.goto('/');
  await expect(lp.getByText(tutor.email).first()).toBeVisible();
  await lp.getByRole('link', { name: 'Alerts' }).first().click();
  await expect(lp.getByText(`${tutor.name} accepted your session`).first()).toBeVisible();

  await learnerCtx.close();
  await tutorCtx.close();
});
