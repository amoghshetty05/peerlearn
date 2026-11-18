// Shared helpers: every test creates its own users through the API, so tests never depend on
// each other or on data left by an earlier run.
const { request, expect } = require('@playwright/test');

const BASE_URL = process.env.BASE_URL || 'https://localhost';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@pes.edu';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'ChangeMe-Admin-1';
const PASSWORD = 'E2e-Password-1';

let counter = 0;
/** A short id that is unique for this run, e.g. "m3k9x2a1". */
function uid() {
  counter += 1;
  return (Date.now().toString(36) + counter.toString(36) + Math.floor(Math.random() * 1296).toString(36)).toLowerCase();
}

async function apiContext(token) {
  return request.newContext({
    baseURL: BASE_URL,
    ignoreHTTPSErrors: true,
    extraHTTPHeaders: token ? { Authorization: `Bearer ${token}` } : {},
  });
}

/** Registers a user through the API and returns { id, name, email, password, token, api }. */
async function createUser(role, label = role) {
  const id = uid();
  const user = { name: `${label[0].toUpperCase()}${label.slice(1)} ${id}`, email: `e2e.${role}.${id}@pes.edu`, password: PASSWORD };
  const anon = await apiContext();
  const reg = await anon.post('/api/auth/register', { data: { ...user, role, phone: '+91 98450 10101' } });
  expect(reg.status(), await reg.text()).toBe(201);
  const login = await anon.post('/api/auth/login', { data: { email: user.email, password: user.password } });
  expect(login.status()).toBe(200);
  const { token } = await login.json();
  const me = await (await apiContext(token)).get('/api/users/me');
  return { ...user, id: (await me.json()).id, token, api: await apiContext(token) };
}

/** A Tutor who teaches `subject` at `level` and is free on `weekday` from `from` to `to`. */
async function createTutor(subject, level = 'Advanced', weekday = 1, from = '16:00', to = '17:00', label = 'tutor') {
  const t = await createUser('tutor', label);
  expect((await t.api.post('/api/tutors/me/subjects', { data: { subject, proficiency: level } })).status()).toBe(201);
  expect((await t.api.post('/api/tutors/me/availability', { data: { weekday, startTime: from, endTime: to } })).status()).toBe(201);
  return t;
}

async function adminLogin() {
  const anon = await apiContext();
  const res = await anon.post('/api/auth/login', { data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD } });
  expect(res.status(), 'Admin login (set ADMIN_EMAIL / ADMIN_PASSWORD)').toBe(200);
  return (await res.json()).token;
}

/** Next given ISO weekday (1 = Monday) at hh:00 IST, as the value a datetime-local input expects. */
function nextWeekdayLocal(weekday = 1, hour = 16) {
  const ist = new Date(Date.now() + 5.5 * 3600_000);
  const today = ist.getUTCDay() === 0 ? 7 : ist.getUTCDay();
  const add = ((weekday - today + 7) % 7) || 7;
  const d = new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate() + add, hour, 0));
  const p = (n) => String(n).padStart(2, '0');
  return { local: `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}T${p(hour)}:00`, date: d };
}

/** Logs in through the login page and waits for the dashboard. */
async function loginUI(page, email, password = PASSWORD) {
  await page.goto('/login');
  await page.getByLabel('PES email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page).not.toHaveURL(/\/login/);
  await expect(page.locator('h1').first()).toBeVisible();
}

/** Learner creates a help request through the UI and waits for the ranked matches. */
async function searchTutors(page, subject, topic = 'Integration by parts') {
  await page.locator('main').getByRole('link', { name: 'Find a tutor' }).first().click();
  await page.getByLabel('Subject').fill(subject);
  await page.getByLabel('What do you need help with?').fill(topic);
  await page.getByLabel('Preferred date and time (IST)').fill(nextWeekdayLocal(1, 16).local);
  await page.getByRole('button', { name: 'Show matching tutors' }).click();
  await expect(page.getByRole('heading', { name: 'Your best matches' })).toBeVisible();
}

module.exports = { BASE_URL, PASSWORD, uid, apiContext, createUser, createTutor, adminLogin, nextWeekdayLocal, loginUI, searchTutors };
