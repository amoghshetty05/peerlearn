// TC-21 (FR-01, FR-02): registration with a PES email only, login, logout and wrong-password handling.
const { test, expect } = require('@playwright/test');
const { uid, PASSWORD, loginUI } = require('./helpers');

test.describe('TC-21 Registration and login', () => {
  test('a non-PES email cannot be used to register (FR-01)', async ({ page }) => {
    await page.goto('/register');
    await page.getByRole('radio', { name: 'I need help' }).click();
    await page.getByLabel('Full name').fill('Ravi Kumar');
    await page.getByLabel('PES email').fill('ravi.kumar@gmail.com');
    await page.getByLabel('Password').fill('Secret1234');
    await expect(page.getByRole('button', { name: 'Create account' })).toBeDisabled();
  });

  test('a student registers, logs out, and logs back in (FR-01, FR-02)', async ({ page }) => {
    const id = uid();
    const email = `e2e.new.${id}@pes.edu`;
    await page.goto('/register');
    await page.getByRole('radio', { name: 'I need help' }).click();
    await page.getByLabel('Full name').fill(`Neha ${id}`);
    await page.getByLabel('PES email').fill(email);
    await page.getByLabel('Password').fill(PASSWORD);
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page.getByRole('heading', { name: 'Hi, Neha' })).toBeVisible();

    await page.getByRole('button', { name: 'Log out' }).first().click();
    await expect(page).toHaveURL(/\/login/);

    await page.getByLabel('PES email').fill(email);
    await page.getByLabel('Password').fill('wrong-password');
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole('heading', { name: 'Hi, Neha' })).toHaveCount(0);

    await loginUI(page, email);
    await expect(page.getByRole('heading', { name: 'Hi, Neha' })).toBeVisible();
  });
});
