'use client';

import { ErrorState } from '@/components/ui/primitives';

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorState title="Falha ao renderizar esta página" description={error.message || 'Erro inesperado.'} onRetry={reset} />;
}
