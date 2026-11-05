#!/usr/bin/env node
/**
 * Generates CAREER_OS_PASSWORD_HASH and a random CAREER_OS_SESSION_SECRET.
 * The password is read from stdin, so it never lands in shell history:
 *
 *   node scripts/hash-password.mjs      # type the password, press Enter
 *
 * Paste both lines into the Vercel project's Environment Variables (or a local .env.local).
 */
import { randomBytes, scrypt } from 'node:crypto';
import { createInterface } from 'node:readline';

const rl = createInterface({ input: process.stdin, output: process.stderr, terminal: false });
if (process.stdin.isTTY) process.stderr.write('Senha do dashboard (mínimo 12 caracteres): ');
rl.once('line', (pw) => {
  rl.close();
  if (pw.length < 12) {
    console.error('\nSenha muito curta (mínimo 12 caracteres).');
    process.exit(1);
  }
  const salt = randomBytes(16);
  const [N, r, p] = [16384, 8, 1];
  scrypt(pw, salt, 32, { N, r, p }, (err, key) => {
    if (err) throw err;
    const hash = ['scrypt', N, r, p, salt.toString('base64'), key.toString('base64')].join('$');
    console.log(`\nCAREER_OS_PASSWORD_HASH=${hash}`);
    console.log(`CAREER_OS_SESSION_SECRET=${randomBytes(48).toString('base64url')}`);
  });
});
