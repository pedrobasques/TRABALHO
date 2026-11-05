/**
 * FAIL_BASE_URL: server started with CAREER_OS_STORE=postgres and an unreachable DATABASE_URL.
 * WB_BASE_URL + WB_ROOT: server with CAREER_OS_DATA_SOURCE=career-ops on a COPY of a career-ops
 * data root (WB_ROOT) and the file store — moves must be written to WB_ROOT/data/applications.md.
 * Each part is skipped (reported as skipped, never as passed) when its env is missing.
 */
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { FAIL_BASE_URL, WB_BASE_URL, WB_ROOT } = process.env;
let browser;
before(async () => {
  if (FAIL_BASE_URL || WB_BASE_URL) browser = await require('playwright').chromium.launch();
});
after(async () => browser?.close());

test('DB unavailable: API answers 503 and the UI refuses the change — never "salvo"', { skip: !FAIL_BASE_URL && 'FAIL_BASE_URL not set' }, async () => {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const api = await page.request.get(FAIL_BASE_URL + '/api/pipeline');
  assert.equal(api.status(), 503);
  assert.equal((await api.json()).code, 'unavailable');
  const patch = await page.request.patch(FAIL_BASE_URL + '/api/pipeline/d07', { data: { stage: 'interview' }, headers: { origin: FAIL_BASE_URL } });
  assert.equal(patch.status(), 503);
  await page.goto(FAIL_BASE_URL + '/applications');
  await page.getByTestId('persistence-badge').getByText('Erro de persistência').waitFor();
  const card = page.getByTestId('app-card').first();
  await card.getByRole('button').click();
  await page.getByTestId('app-drawer').waitFor();
  const before = await page.getByTestId('stage-select').inputValue();
  const target = before === 'interview' ? 'offer' : 'interview';
  await page.getByTestId('stage-select').selectOption(target);
  await page.getByRole('alert').filter({ hasText: /indispon|Falha|NÃO salvo|unavailable/i }).first().waitFor();
  assert.equal(await page.getByText('salvo', { exact: true }).count(), 0, 'no "salvo" badge after a failed write');
  assert.equal(await page.getByTestId('stage-select').inputValue(), before, 'stage unchanged');
  await page.close();
});

test('write-through: a move in the dashboard updates the canonical tracker via set-status.mjs', { skip: !(WB_BASE_URL && WB_ROOT) && 'WB_BASE_URL/WB_ROOT not set' }, async () => {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const tracker = () => readFileSync(join(WB_ROOT, 'data', 'applications.md'), 'utf8');
  const rowOf = (num) => tracker().split('\n').find((l) => l.startsWith(`| ${num} |`));
  assert.match(rowOf(6), /\| Applied \|/);
  await page.goto(WB_BASE_URL + '/applications?open=co-app-6');
  await page.getByTestId('app-drawer').waitFor();
  await page.getByTestId('persistence-badge').waitFor();
  await page.getByTestId('stage-select').selectOption('interview');
  await page.getByText(/Gravado no tracker do career-ops/).waitFor();
  assert.match(rowOf(6), /\| Interview \|/, 'tracker row updated');
  assert.match(rowOf(6), /career-os:/, 'note links the journal event');
  const ledger = readFileSync(join(WB_ROOT, 'data', 'status-log.tsv'), 'utf8');
  assert.match(ledger, /^6\t\d{4}-\d{2}-\d{2}\tApplied\tInterview\tweb/m);
  await page.getByTestId('history').getByText('no tracker').first().waitFor();
  // journal-only stage: saved, flagged as not applicable, tracker untouched
  await page.getByTestId('stage-select').selectOption('preparing');
  await page.getByText(/registrada só no diário/).waitFor();
  assert.match(rowOf(6), /\| Interview \|/);
  await page.close();
});
