/**
 * End-to-end tests for the Career OS dashboard.
 *
 * Requires a running server (npm run build && npm start) — BASE_URL defaults
 * to http://127.0.0.1:3100 — and Playwright with Chromium available
 * (pre-installed in the Claude Code cloud container; elsewhere: npx playwright install chromium).
 * Runs against the DEMO dataset (CAREER_OS_DATA_SOURCE=demo or auto without career-ops data).
 */
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:3100';

let browser;
let ctx;
let page;
const errors = [];

before(async () => {
  browser = await chromium.launch();
  ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
});
after(async () => {
  await browser?.close();
});

const go = async (path) => {
  const res = await page.goto(BASE + path, { waitUntil: 'load' });
  await page.waitForLoadState('domcontentloaded');
  return res;
};
const kpi = async (id) => (await page.getByTestId(`${id}-value`).innerText()).trim();
const resultCount = async () => Number((await page.getByTestId('result-count').locator('span').first().innerText()).replace(/\D/g, ''));

describe('Career OS dashboard', () => {
  test('1. dashboard opens with KPIs, DEMO indicator and no runtime errors', async () => {
    const res = await go('/');
    assert.equal(res.status(), 200);
    assert.match(page.url(), /\/dashboard/);
    await page.getByRole('heading', { name: 'Career Command Center' }).waitFor();
    assert.ok(await page.getByTestId('demo-indicator').first().isVisible());
    assert.match(await kpi('kpi-identified'), /^\d+$/);
    assert.ok((await page.getByTestId('opportunity-card').count()) > 0);
    assert.ok((await page.getByTestId('action-center').locator('li').count()) > 0);
    assert.deepEqual(errors, []);
  });

  test('2. sidebar navigation works and marks the active page', async () => {
    await go('/dashboard');
    const nav = page.getByRole('navigation', { name: 'Navegação principal' }).first();
    for (const [label, path] of [['Job Radar', '/jobs'], ['Pipeline', '/applications'], ['Analytics', '/analytics'], ['Perfil', '/profile'], ['CV Studio', '/cv-studio'], ['Automações', '/automations'], ['Configurações', '/settings'], ['Command Center', '/dashboard']]) {
      await nav.getByRole('link', { name: label }).click();
      await page.waitForURL(`**${path}`);
      assert.equal(await nav.getByRole('link', { name: label }).getAttribute('aria-current'), 'page', label);
    }
  });

  test('3. job search narrows results (accent-insensitive)', async () => {
    await go('/jobs');
    const total = await resultCount();
    await page.getByRole('searchbox', { name: 'Buscar vagas' }).fill('mineracao');
    await page.waitForFunction((t) => Number(document.querySelector('[data-testid=result-count] span').textContent) < t, total);
    const n = await resultCount();
    assert.ok(n > 0 && n < total, `${n} of ${total}`);
  });

  test('4. country filter applies and can be cleared', async () => {
    await go('/jobs');
    const total = await resultCount();
    await page.getByTestId('filter-bar').getByRole('button', { name: /^País/ }).click();
    await page.getByRole('option', { name: /Itália/ }).click();
    await page.keyboard.press('Escape');
    const n = await resultCount();
    assert.ok(n > 0 && n < total);
    const countries = await page.getByTestId('jobs-table').locator('tbody tr td:nth-child(3)').allInnerTexts();
    assert.ok(countries.every((c) => c.includes('Itália')), countries.join(','));
    await page.getByRole('button', { name: 'Limpar filtros' }).first().click();
    assert.equal(await resultCount(), total);
  });

  test('5. opening a job shows the intelligence page', async () => {
    await go('/jobs');
    await page.getByTestId('jobs-table').locator('tbody tr').first().click();
    await page.waitForURL(/\/jobs\/[^/]+$/);
    await page.getByTestId('match-card').waitFor();
    assert.ok(await page.getByText('Requisitos × perfil').isVisible());
    assert.ok(await page.getByText('Career Strategy').isVisible());
    // external submission is never enabled
    assert.ok(await page.getByRole('button', { name: 'Candidatar no portal' }).isDisabled());
  });

  test('6. period selector updates KPIs and URL', async () => {
    await go('/dashboard?period=all');
    const all = Number(await kpi('kpi-identified'));
    await page.getByRole('radio', { name: '7 dias' }).click();
    await page.waitForURL(/period=7d/);
    const week = Number(await kpi('kpi-identified'));
    assert.ok(week < all, `${week} < ${all}`);
  });

  test('7. pipeline renders all kanban columns', async () => {
    await go('/applications');
    await page.getByTestId('kanban').waitFor();
    for (const s of ['discovered', 'qualified', 'preparing', 'ready_for_review', 'submitted', 'responded', 'interview', 'offer', 'closed']) {
      assert.ok(await page.getByTestId(`column-${s}`).isVisible(), s);
    }
    assert.ok((await page.getByTestId('app-card').count()) > 0);
  });

  test('8. kanban ↔ table toggle and history drawer', async () => {
    await go('/applications');
    await page.getByRole('radio', { name: 'Tabela' }).click();
    await page.getByTestId('applications-table').waitFor();
    await page.getByTestId('applications-table').locator('tbody tr').first().click();
    await page.getByTestId('app-drawer').waitFor();
    assert.ok((await page.getByTestId('history').locator('li').count()) >= 1);
    await page.keyboard.press('Escape');
    await page.getByTestId('app-drawer').waitFor({ state: 'detached' });
    await page.getByRole('radio', { name: 'Kanban' }).click();
    await page.getByTestId('kanban').waitFor();
  });

  test('9. analytics renders charts', async () => {
    await go('/analytics');
    await page.getByTestId('charts').waitFor();
    assert.ok(await page.getByTestId('funnel').isVisible());
    assert.ok((await page.getByTestId('charts').locator('svg[role=img]').count()) >= 1);
    assert.equal(await page.getByTestId('empty-state').count(), 0);
  });

  test('10. mobile: no horizontal overflow and drawer navigation', async () => {
    const m = await browser.newPage({ viewport: { width: 390, height: 844 } });
    for (const p of ['/dashboard', '/jobs', '/applications', '/analytics', '/jobs/d01', '/profile']) {
      await m.goto(BASE + p, { waitUntil: 'load' });
      const overflow = await m.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
      assert.equal(overflow, false, `horizontal overflow on ${p}`);
    }
    await m.goto(BASE + '/dashboard', { waitUntil: 'load' });
    await m.getByTestId('mobile-menu').click();
    await m.getByRole('dialog', { name: 'Menu' }).getByRole('link', { name: 'Job Radar' }).click();
    await m.waitForURL('**/jobs');
    await m.getByTestId('jobs-list-mobile').waitFor();
    await m.close();
  });

  test('11. send to pipeline and move a card persist on the server with history', async () => {
    const st = await (await page.request.get(BASE + '/api/pipeline')).json();
    assert.ok(['file', 'postgres'].includes(st.status.kind), `expected server persistence, got ${st.status.kind}`);
    await go('/jobs/d08'); // not in the demo source pipeline
    await page.getByTestId('persistence-badge').waitFor(); // persistence status loaded
    const already = await page.getByRole('link', { name: /No pipeline/ }).count();
    if (!already) {
      await page.getByRole('button', { name: 'Enviar ao pipeline' }).click();
      await page.getByRole('dialog').getByRole('button', { name: 'Adicionar' }).click();
      await page.getByText(/Adicionada ao pipeline \(salvo no servidor\)|já está no pipeline/).waitFor();
    }
    // persisted server-side: visible through the API in a fresh request context
    const fresh = await browser.newContext();
    const list = await (await fresh.request.get(BASE + '/api/pipeline')).json();
    await fresh.close();
    const app = list.applications.find((a) => a.job.jobId === 'd08');
    assert.ok(app, 'd08 must be stored server-side');
    // move via the drawer select and check the event log
    await go(`/applications?open=${encodeURIComponent(app.id)}`);
    await page.getByTestId('app-drawer').waitFor();
    const target = app.stage === 'qualified' ? 'preparing' : 'qualified';
    await page.getByTestId('stage-select').selectOption(target);
    await page.getByText(/salvo com histórico/).waitFor();
    const ev = await (await page.request.get(BASE + '/api/pipeline/d08/events')).json();
    assert.equal(ev.events.at(-1).to, target);
    assert.ok(ev.events.length >= 2);
  });

  test('12. diagnostics run returns real checks', async () => {
    await go('/automations');
    await page.getByTestId('run-diagnostics').click();
    await page.getByTestId('diagnostics').getByText('career-ops vendorizado').waitFor();
    assert.ok(await page.getByText('Node.js ≥ 22.18').isVisible());
  });

  test('13. unknown job id returns 404', async () => {
    const res = await go('/jobs/does-not-exist');
    assert.equal(res.status(), 404);
  });
});
