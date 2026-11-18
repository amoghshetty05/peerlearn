// TC-25 (FR-10): a user creates a study group; another Learner joins and leaves it.
const { test, expect } = require('@playwright/test');
const { uid, createUser, loginUI } = require('./helpers');

test('TC-25 create, join and leave a study group', async ({ browser }) => {
  const subject = `e2e${uid()}`;
  const owner = await createUser('learner', 'owner');
  const member = await createUser('learner', 'member');

  const oc = await browser.newContext();
  const op = await oc.newPage();
  await loginUI(op, owner.email);
  await op.getByRole('link', { name: 'Groups' }).first().click();
  await op.getByRole('button', { name: 'New group' }).click();
  await op.getByLabel('Group name (optional)').fill(`Revision ${subject}`);
  await op.getByLabel('Subject', { exact: true }).fill(subject);
  await op.getByRole('button', { name: 'Create group' }).click();
  await expect(op.getByText('Study group created.')).toBeVisible();

  const mc = await browser.newContext();
  const mp = await mc.newPage();
  await loginUI(mp, member.email);
  await mp.getByRole('link', { name: 'Groups' }).first().click();
  const card = mp.locator('li, article, div.card').filter({ hasText: `Revision ${subject}` }).last();
  await card.getByRole('button', { name: 'Join' }).click();
  await expect(mp.getByText('You joined the group.')).toBeVisible();
  await card.getByRole('button', { name: 'Leave' }).click();
  await expect(mp.getByText('You left the group.')).toBeVisible();

  await oc.close();
  await mc.close();
});
