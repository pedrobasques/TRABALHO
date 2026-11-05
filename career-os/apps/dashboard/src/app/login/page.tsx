import { redirect } from 'next/navigation';
import { BriefcaseBusiness, Lock } from 'lucide-react';
import { resolveAuthConfig, safeNext } from '@/lib/auth/session';

export const metadata = { title: 'Entrar' };
export const dynamic = 'force-dynamic';

const ERRORS: Record<string, string> = {
  invalid: 'Senha incorreta.',
  rate: 'Muitas tentativas. Aguarde alguns minutos.',
  config: 'Autenticação não configurada no servidor.',
  disabled: 'Autenticação desativada neste ambiente local.',
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const auth = resolveAuthConfig(process.env);
  if (auth.mode === 'off') redirect('/dashboard');
  const next = safeNext(sp.next);
  const error = sp.error ? ERRORS[sp.error] ?? 'Falha no login.' : null;

  return (
    <main className="grid min-h-dvh place-items-center bg-bg px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <span className="grid size-11 place-items-center rounded-xl bg-accent text-accent-fg">
            <BriefcaseBusiness className="size-5" aria-hidden />
          </span>
          <h1 className="mt-4 text-xl font-semibold tracking-tight text-fg">Career OS</h1>
          <p className="mt-1 text-sm text-muted">Acesso restrito ao proprietário</p>
        </div>
        <form method="post" action="/api/auth/login" className="rounded-xl border border-border bg-surface p-6 shadow-card">
          <input type="hidden" name="next" value={next} />
          <label htmlFor="password" className="mb-1.5 block text-xs font-medium text-muted">
            Senha
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
            autoFocus
            className="h-10 w-full rounded-lg border border-border bg-bg-elevated px-3 text-sm text-fg focus:border-accent focus:outline-none"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? 'login-error' : undefined}
          />
          {error && (
            <p id="login-error" role="alert" className="mt-2 text-xs text-danger">
              {error}
            </p>
          )}
          <button type="submit" className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-accent text-sm font-medium text-accent-fg hover:bg-accent-hover">
            <Lock className="size-4" aria-hidden /> Entrar
          </button>
        </form>
        <p className="mt-4 text-center text-[11px] text-subtle">Sessão de 12 horas · cookie httpOnly · nenhuma conta de terceiros envolvida</p>
      </div>
    </main>
  );
}
