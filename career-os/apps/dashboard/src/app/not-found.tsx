import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md py-24 text-center">
      <p className="text-sm font-medium text-accent">404</p>
      <h1 className="mt-2 text-xl font-semibold">Página não encontrada</h1>
      <p className="mt-2 text-sm text-muted">O item pode ter sido removido ou o link está incorreto.</p>
      <Link href="/dashboard" className="mt-6 inline-flex h-9 items-center rounded-lg bg-accent px-4 text-sm font-medium text-accent-fg hover:bg-accent-hover">
        Voltar ao Command Center
      </Link>
    </div>
  );
}
