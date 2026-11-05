'use client';

import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { cn } from '@/lib/format';

interface ToastItem {
  id: number;
  message: ReactNode;
  tone: 'success' | 'info' | 'error';
}

const Ctx = createContext<(message: ReactNode, tone?: ToastItem['tone']) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const push = useCallback((message: ReactNode, tone: ToastItem['tone'] = 'success') => {
    const id = Date.now() + Math.random();
    setItems((xs) => [...xs.slice(-2), { id, message, tone }]);
    setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== id)), tone === 'error' ? 8000 : 4000);
  }, []);
  return (
    <Ctx.Provider value={push}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed right-4 bottom-4 z-50 flex w-[min(92vw,360px)] flex-col gap-2">
        {items.map((t) => (
          <div key={t.id} role={t.tone === 'error' ? 'alert' : 'status'} className="animate-in pointer-events-auto flex items-start gap-2.5 rounded-lg border border-border bg-bg-elevated px-3.5 py-3 text-sm text-fg shadow-card">
            {t.tone === 'success' ? (
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />
            ) : t.tone === 'error' ? (
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-danger" />
            ) : (
              <Info className="mt-0.5 size-4 shrink-0 text-accent" />
            )}
            <div className="min-w-0 flex-1">{t.message}</div>
            <button type="button" aria-label="Fechar notificação" className={cn('rounded p-0.5 text-subtle hover:text-fg')} onClick={() => setItems((xs) => xs.filter((x) => x.id !== t.id))}>
              <X className="size-3.5" />
            </button>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function useToast() {
  return useContext(Ctx);
}
