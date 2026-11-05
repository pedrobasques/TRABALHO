/**
 * Auth gate e2e. Requires a server started with CAREER_OS_AUTH_MODE=password and
 * AUTH_BASE_URL + AUTH_PASSWORD env for this test process. Skipped otherwise.
 */
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const BASE = process.env.AUTH_BASE_URL;
const PASSWORD = process.env.AUTH_PASSWORD;

if (!BASE || !PASSWORD) {
  test('auth e2e (skipped: AUTH_BASE_URL/AUTH_PASSWORD not set)', { skip: true }, () => {});
} else {
  const { chromium } = require('playwright');
  let browser;
  before(async () => (browser = await chromium.launch()));
  after(async () => browser?.close());

  test('anonymous visitors are sent to /login and APIs return 401', async () => {
    const page = await browser.newPage();
    await page.goto(BASE + '/jobs?q=x');
    assert.match(page.url(), /\/login\?next=%2Fjobs/);
    const api = await page.request.get(BASE + '/api/pipeline');
    assert.equal(api.status(), 401);
    await page.close();
  });

  test('wrong password shows an error; right password returns to the requested page; logout ends the session', async () => {
    const page = await browser.newPage();
    await page.goto(BASE + '/analytics');
    await page.getByLabel('Senha').fill('definitely-wrong');
    await page.getByRole('button', { name: 'Entrar' }).click();
    await page.locator('#login-error').waitFor();
    assert.match(await page.locator('#login-error').innerText(), /Senha incorreta/);
    await page.getByLabel('Senha').fill(PASSWORD);
    await page.getByRole('button', { name: 'Entrar' }).click();
    await page.waitForURL('**/analytics');
    await page.getByRole('heading', { name: 'Analytics & Reports' }).waitFor();
    const cookies = await page.context().cookies();
    const c = cookies.find((x) => x.name === 'cos_session');
    assert.ok(c && c.httpOnly && c.sameSite === 'Lax');
    await page.getByRole('button', { name: 'Sair' }).click();
    await page.waitForURL('**/login');
    await page.goto(BASE + '/dashboard');
    assert.match(page.url(), /\/login/);
    await page.close();
  });
}
