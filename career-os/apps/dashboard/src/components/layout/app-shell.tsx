'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import {
  BarChart3,
  Bot,
  BriefcaseBusiness,
  ChevronsLeft,
  ChevronsRight,
  FileText,
  KanbanSquare,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Radar,
  Settings,
  Sun,
  UserRound,
  X,
} from 'lucide-react';
import { cn } from '@/lib/format';
import { useStore } from '@/lib/store';
import { DemoIndicator, StatusBadge } from '@/components/ui/primitives';

export const NAV = [
  { group: 'Operação', items: [
    { href: '/dashboard', label: 'Command Center', icon: LayoutDashboard },
    { href: '/jobs', label: 'Job Radar', icon: Radar },
    { href: '/applications', label: 'Pipeline', icon: KanbanSquare },
    { href: '/analytics', label: 'Analytics', icon: BarChart3 },
  ] },
  { group: 'Carreira', items: [
    { href: '/profile', label: 'Perfil', icon: UserRound },
    { href: '/cv-studio', label: 'CV Studio', icon: FileText },
  ] },
  { group: 'Sistema', items: [
    { href: '/automations', label: 'Automações', icon: Bot },
    { href: '/settings', label: 'Configurações', icon: Settings },
  ] },
] as const;

function Logo({ collapsed }: { collapsed?: boolean }) {
  return (
    <Link href="/dashboard" className="flex items-center gap-2.5 rounded-lg px-1" aria-label="Career OS — início">
      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-accent text-accent-fg">
        <BriefcaseBusiness className="size-4" aria-hidden />
      </span>
      {!collapsed && (
        <span className="leading-tight">
          <span className="block text-sm font-semibold tracking-tight text-fg">Career OS</span>
          <span className="block text-[11px] text-subtle">Career intelligence</span>
        </span>
      )}
    </Link>
  );
}

function NavLinks({ collapsed, onNavigate }: { collapsed?: boolean; onNavigate?: () => void }) {
  const path = usePathname();
  return (
    <nav aria-label="Navegação principal" className="flex flex-col gap-5">
      {NAV.map((g) => (
        <div key={g.group}>
          {!collapsed && <div className="mb-1.5 px-2.5 text-[11px] font-medium tracking-wider text-subtle uppercase">{g.group}</div>}
          <ul className="space-y-0.5">
            {g.items.map((it) => {
              const active = path === it.href || path.startsWith(`${it.href}/`);
              const Icon = it.icon;
              return (
                <li key={it.href}>
                  <Link
                    href={it.href}
                    onClick={onNavigate}
                    aria-current={active ? 'page' : undefined}
                    title={collapsed ? it.label : undefined}
                    className={cn(
                      'group relative flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-sm transition-colors',
                      active ? 'bg-accent-soft font-medium text-fg' : 'text-muted hover:bg-surface-hover hover:text-fg',
                      collapsed && 'justify-center px-0',
                    )}
                  >
                    {active && <span className="absolute top-1.5 bottom-1.5 left-0 w-0.5 rounded-full bg-accent" aria-hidden />}
                    <Icon className={cn('size-4 shrink-0', active ? 'text-accent' : 'text-subtle group-hover:text-fg')} aria-hidden />
                    {!collapsed && <span className="truncate">{it.label}</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function ThemeToggle() {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  useEffect(() => {
    setTheme(document.documentElement.dataset.theme === 'light' ? 'light' : 'dark');
  }, []);
  const toggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem('career-os:theme', next);
    } catch {
      /* ignore */
    }
  };
  return (
    <button type="button" onClick={toggle} className="grid size-9 place-items-center rounded-lg text-muted hover:bg-surface-hover hover:text-fg" aria-label={theme === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro'}>
      {theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </button>
  );
}

function QuickSearch() {
  const router = useRouter();
  const [q, setQ] = useState('');
  return (
    <form
      role="search"
      className="hidden min-w-0 flex-1 md:block md:max-w-sm"
      onSubmit={(e) => {
        e.preventDefault();
        router.push(`/jobs${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ''}`);
      }}
    >
      <label className="sr-only" htmlFor="global-search">
        Buscar vagas
      </label>
      <input
        id="global-search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Buscar vagas, empresas, competências…"
        className="h-9 w-full rounded-lg border border-border bg-surface px-3 text-sm text-fg placeholder:text-subtle hover:border-border-strong focus:border-accent focus:outline-none"
      />
    </form>
  );
}

function PersistenceBadge() {
  const { persistence } = useStore();
  if (persistence.kind === 'loading') return null;
  const label = persistence.kind === 'postgres' ? 'Supabase' : persistence.kind === 'file' ? 'Arquivo local' : persistence.kind === 'error' ? 'Erro de persistência' : 'Só navegador';
  const tone = persistence.kind === 'postgres' || persistence.kind === 'file' ? 'success' : persistence.kind === 'error' ? 'danger' : 'warning';
  return (
    <Link href="/settings#persistence" className="hidden sm:inline-flex" data-testid="persistence-badge">
      <StatusBadge tone={tone} dot title={persistence.detail}>
        {label}
      </StatusBadge>
    </Link>
  );
}

export function AppShell({ children, authEnabled = false }: { children: ReactNode; authEnabled?: boolean }) {
  const { dataset, localChanges } = useStore();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const path = usePathname();
  useEffect(() => setMobileOpen(false), [path]);
  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem('career-os:sidebar') === 'collapsed');
    } catch {
      /* ignore */
    }
  }, []);
  const toggleCollapsed = () => {
    setCollapsed((c) => {
      try {
        localStorage.setItem('career-os:sidebar', c ? 'expanded' : 'collapsed');
      } catch {
        /* ignore */
      }
      return !c;
    });
  };

  return (
    <div className="min-h-dvh bg-bg">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-accent focus:px-3 focus:py-2 focus:text-accent-fg">
        Pular para o conteúdo
      </a>

      {/* desktop sidebar */}
      <aside className={cn('fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-border bg-sidebar transition-[width] duration-200 lg:flex', collapsed ? 'w-[68px]' : 'w-60')}>
        <div className={cn('flex h-14 items-center border-b border-border px-3', collapsed && 'justify-center')}>
          <Logo collapsed={collapsed} />
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-4">
          <NavLinks collapsed={collapsed} />
        </div>
        <div className="border-t border-border p-3">
          {!collapsed && (
            <div className="mb-2 rounded-lg bg-surface-2 px-2.5 py-2 text-[11px] text-muted">
              Fonte: <span className="font-medium text-fg">{dataset.origin === 'demo' ? 'demonstração' : 'career-ops'}</span>
              <br />
              Referência: <span className="tabular">{dataset.asOf}</span>
            </div>
          )}
          <button type="button" onClick={toggleCollapsed} className="flex h-8 w-full items-center justify-center gap-2 rounded-lg text-xs text-muted hover:bg-surface-hover hover:text-fg" aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}>
            {collapsed ? <ChevronsRight className="size-4" /> : <><ChevronsLeft className="size-4" /> Recolher</>}
          </button>
        </div>
      </aside>

      {/* mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="absolute inset-0 bg-black/60" onClick={() => setMobileOpen(false)} />
          <div className="animate-in absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col border-r border-border bg-sidebar">
            <div className="flex h-14 items-center justify-between border-b border-border px-3">
              <Logo />
              <button type="button" onClick={() => setMobileOpen(false)} className="grid size-9 place-items-center rounded-lg text-muted hover:text-fg" aria-label="Fechar menu">
                <X className="size-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-3 py-4">
              <NavLinks onNavigate={() => setMobileOpen(false)} />
            </div>
          </div>
        </div>
      )}

      <div className={cn('transition-[padding] duration-200', collapsed ? 'lg:pl-[68px]' : 'lg:pl-60')}>
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-border bg-bg/85 px-4 backdrop-blur-md sm:px-6">
          <button type="button" onClick={() => setMobileOpen(true)} className="grid size-9 place-items-center rounded-lg text-muted hover:bg-surface-hover hover:text-fg lg:hidden" aria-label="Abrir menu" data-testid="mobile-menu">
            <Menu className="size-5" />
          </button>
          <div className="lg:hidden">
            <Logo collapsed />
          </div>
          <QuickSearch />
          <div className="ml-auto flex items-center gap-2">
            {dataset.origin === 'demo' && <DemoIndicator />}
            {localChanges > 0 && (
              <Link href="/settings#local">
                <StatusBadge tone="info" title="Alterações salvas apenas neste navegador">
                  {localChanges} local
                </StatusBadge>
              </Link>
            )}
            <PersistenceBadge />
            <ThemeToggle />
            {authEnabled && (
              <form method="post" action="/api/auth/logout">
                <button type="submit" className="grid size-9 place-items-center rounded-lg text-muted hover:bg-surface-hover hover:text-fg" aria-label="Sair" title="Sair">
                  <LogOut className="size-4" />
                </button>
              </form>
            )}
          </div>
        </header>
        <main id="main" className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
