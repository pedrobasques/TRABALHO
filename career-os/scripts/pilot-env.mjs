#!/usr/bin/env node
/**
 * Load the ignored local .env.local file, then run the existing Bash pilot.
 * Existing process environment variables take precedence over values in the file.
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const envFile = resolve(ROOT, '.env.local');

if (existsSync(envFile)) process.loadEnvFile(envFile);

const result = spawnSync('bash', [resolve(ROOT, 'scripts/pilot.sh'), ...process.argv.slice(2)], {
  cwd: ROOT,
  env: process.env,
  stdio: 'inherit',
});

if (result.error) {
  console.error('Não foi possível iniciar o piloto. Confirme se o Git Bash está disponível no PATH.');
  process.exit(1);
}

process.exit(result.status ?? 1);
