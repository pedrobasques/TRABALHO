import { NextResponse } from 'next/server';
import { SESSION_COOKIE, requestOrigin } from '@/lib/auth/session';

export function POST(req: Request) {
  const origin = requestOrigin(req);
  const res = NextResponse.redirect(new URL('/login', origin), 303);
  res.cookies.set(SESSION_COOKIE, '', { path: '/', maxAge: 0, httpOnly: true, sameSite: 'lax', secure: origin.startsWith('https:') });
  return res;
}
