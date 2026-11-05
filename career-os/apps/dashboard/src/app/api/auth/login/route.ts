import { NextResponse } from 'next/server';
import { SESSION_COOKIE, SESSION_TTL_SECONDS, requestOrigin, resolveAuthConfig, safeNext, signSession } from '@/lib/auth/session';
import { rateLimit, verifyPassword } from '@/lib/auth/password';

export const dynamic = 'force-dynamic';

function back(req: Request, params: Record<string, string>) {
  const url = new URL('/login', requestOrigin(req));
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return NextResponse.redirect(url, 303);
}

export async function POST(req: Request) {
  const auth = resolveAuthConfig(process.env);
  if (auth.mode !== 'password') return back(req, { error: auth.mode === 'off' ? 'disabled' : 'config' });

  const form = await req.formData().catch(() => null);
  const password = String(form?.get('password') ?? '');
  const next = safeNext(String(form?.get('next') ?? ''));

  const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0]!.trim() || 'local';
  const limit = rateLimit(`login:${ip}`);
  if (!limit.ok) return back(req, { error: 'rate', next });

  if (!password || password.length > 512 || !(await verifyPassword(password, auth.passwordHash))) {
    return back(req, { error: 'invalid', next });
  }

  const token = await signSession(auth.ownerId, auth.secret);
  const origin = requestOrigin(req);
  const res = NextResponse.redirect(new URL(next, origin), 303);
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: origin.startsWith('https:'),
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  });
  return res;
}
