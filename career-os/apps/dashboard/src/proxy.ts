import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE, resolveAuthConfig, verifySession } from '@/lib/auth/session';

/**
 * Single choke point for every request (except static build assets):
 *  1. Same-origin guard for state-changing requests (CSRF).
 *  2. Authentication — fails closed: on Vercel, or when misconfigured, nothing is served anonymously.
 */
const PUBLIC = ['/login', '/api/auth/login', '/api/health'];

function isMutating(method: string) {
  return !['GET', 'HEAD', 'OPTIONS'].includes(method);
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (isMutating(req.method)) {
    const site = req.headers.get('sec-fetch-site');
    const origin = req.headers.get('origin');
    const host = req.headers.get('host');
    // Sec-Fetch-Site is authoritative when present (all modern browsers). Origin may be the literal "null".
    const originHost = (() => {
      try {
        return origin && origin !== 'null' ? new URL(origin).host : null;
      } catch {
        return 'invalid';
      }
    })();
    const crossSite = site ? site !== 'same-origin' && site !== 'none' : Boolean(originHost && host && originHost !== host);
    if (crossSite) return NextResponse.json({ error: 'cross-origin request rejected' }, { status: 403 });
  }

  const auth = resolveAuthConfig(process.env);
  if (auth.mode === 'off') return NextResponse.next();

  if (auth.mode === 'misconfigured') {
    if (pathname === '/api/health') return NextResponse.next();
    const body = `Career OS: autenticação não configurada — acesso bloqueado.\n${auth.reason}\nVeja career-os/docs/DEPLOYMENT.md.`;
    return new NextResponse(body, { status: 503, headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' } });
  }

  if (PUBLIC.includes(pathname)) return NextResponse.next();

  const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value, auth.secret);
  if (session) {
    const res = NextResponse.next();
    res.headers.set('cache-control', 'private, no-store');
    return res;
  }

  if (pathname.startsWith('/api/')) return NextResponse.json({ error: 'authentication required' }, { status: 401 });
  const url = req.nextUrl.clone();
  url.pathname = '/login';
  url.search = `?next=${encodeURIComponent(pathname + req.nextUrl.search)}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon.svg).*)'],
};
