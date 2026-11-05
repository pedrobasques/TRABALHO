import { NextResponse } from 'next/server';
import { resolveAuthConfig } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

/** Liveness probe. Exposes only whether auth is configured — never secrets or data. */
export function GET() {
  const auth = resolveAuthConfig(process.env);
  return NextResponse.json({ ok: auth.mode !== 'misconfigured', auth: auth.mode }, { headers: { 'cache-control': 'no-store' } });
}
