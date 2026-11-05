'use client';

/**
 * Client data store.
 *
 * - The dataset (jobs, base applications, profile) comes from the server.
 * - Pipeline changes go to the server-side PipelineStore (/api/pipeline) when the
 *   deployment has one (file locally, Supabase in the cloud). Persisted applications
 *   override the dataset's application for the same job.
 * - When the server reports no persistence (e.g. Vercel without DATABASE_URL), changes
 *   fall back to this browser's localStorage and the UI says so explicitly.
 * - Favorites are always browser-local.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { matchAll, toApplication, type Application, type Dataset, type MatchResult, type PipelineStage, type StageEvent, type StoredApplication } from '@career-os/core';

const KEY = 'career-os:local-overlay:v1';

interface Overlay {
  favorites: string[];
  added: Application[];
  moves: Record<string, StageEvent[]>;
}
const EMPTY: Overlay = { favorites: [], added: [], moves: {} };

export interface PersistenceStatus {
  kind: 'file' | 'postgres' | 'none' | 'loading' | 'error';
  persistent: boolean;
  detail: string;
}

export interface WriteBackInfo {
  attempted: boolean;
  applied: number;
  failed: number;
  detail: string;
}

export type ActionResult = { ok: true; created?: boolean; writeBack?: WriteBackInfo | null } | { ok: false; error: string };

interface Store {
  base: Dataset;
  dataset: Dataset;
  matches: Map<string, MatchResult>;
  overlay: Overlay;
  hydrated: boolean;
  persistence: PersistenceStatus;
  /** Browser-only changes (favorites + fallback pipeline edits). */
  localChanges: number;
  isFavorite: (jobId: string) => boolean;
  toggleFavorite: (jobId: string) => void;
  addToPipeline: (jobId: string) => Promise<ActionResult>;
  moveApplication: (appId: string, stage: PipelineStage) => Promise<ActionResult>;
  resetLocal: () => void;
  /** 'persisted' = stored server-side; 'local' = browser-only; null = untouched source record. */
  changeOrigin: (appId: string) => 'persisted' | 'local' | null;
  refreshPipeline: () => Promise<void>;
}

const Ctx = createContext<Store | null>(null);

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) } });
  const body = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
  return body;
}

export function DataProvider({ dataset: base, children }: { dataset: Dataset; children: React.ReactNode }) {
  const [overlay, setOverlay] = useState<Overlay>(EMPTY);
  const [hydrated, setHydrated] = useState(false);
  const [stored, setStored] = useState<StoredApplication[]>([]);
  const [persistence, setPersistence] = useState<PersistenceStatus>({ kind: 'loading', persistent: false, detail: 'Verificando persistência…' });

  useEffect(() => {
    try {
      const raw = localStorage.getItem(`${KEY}:${base.origin}`);
      if (raw) setOverlay({ ...EMPTY, ...(JSON.parse(raw) as Overlay) });
    } catch {
      /* storage unavailable — overlay stays empty */
    }
    setHydrated(true);
  }, [base.origin]);

  const refreshPipeline = useCallback(async () => {
    try {
      const r = await api<{ status: PersistenceStatus; applications: StoredApplication[] }>('/api/pipeline');
      setPersistence(r.status);
      setStored(r.applications);
    } catch (e) {
      setPersistence({ kind: 'error', persistent: false, detail: `Falha ao ler o pipeline persistido: ${(e as Error).message}` });
    }
  }, []);

  useEffect(() => {
    void refreshPipeline();
  }, [refreshPipeline]);

  const persist = useCallback(
    (next: Overlay) => {
      setOverlay(next);
      try {
        localStorage.setItem(`${KEY}:${base.origin}`, JSON.stringify(next));
      } catch {
        /* ignore */
      }
    },
    [base.origin],
  );

  const serverMode = persistence.kind === 'file' || persistence.kind === 'postgres';

  const dataset = useMemo<Dataset>(() => {
    const byJob = new Map(stored.map((s) => [s.job.jobId, toApplication(s)]));
    let apps = base.applications.map((a) => byJob.get(a.jobId) ?? a);
    const known = new Set(apps.map((a) => a.jobId));
    apps = [...apps, ...[...byJob.values()].filter((a) => !known.has(a.jobId))];
    if (!serverMode) {
      // browser-only fallback
      apps = [...apps, ...overlay.added.filter((a) => !known.has(a.jobId))].map((a) => {
        const extra = overlay.moves[a.id];
        if (!extra?.length) return a;
        const history = [...a.history, ...extra];
        return { ...a, history, stage: history[history.length - 1]!.stage };
      });
    }
    return { ...base, applications: apps };
  }, [base, stored, overlay, serverMode]);

  const matches = useMemo(() => matchAll(base.jobs, base.profile), [base]);
  const persistedIds = useMemo(() => new Set(stored.map((s) => s.id)), [stored]);

  const upsertStored = (app: StoredApplication) => setStored((xs) => [...xs.filter((x) => x.id !== app.id && x.job.jobId !== app.job.jobId), app]);

  const value: Store = {
    base,
    dataset,
    matches,
    overlay,
    hydrated,
    persistence,
    localChanges: overlay.favorites.length + (serverMode ? 0 : overlay.added.length + Object.keys(overlay.moves).length),
    isFavorite: (id) => overlay.favorites.includes(id),
    toggleFavorite: (id) =>
      persist({ ...overlay, favorites: overlay.favorites.includes(id) ? overlay.favorites.filter((x) => x !== id) : [...overlay.favorites, id] }),
    addToPipeline: async (jobId) => {
      if (serverMode) {
        try {
          const r = await api<{ application: StoredApplication; created: boolean; writeBack: WriteBackInfo | null }>('/api/pipeline', { method: 'POST', body: JSON.stringify({ jobId }) });
          upsertStored(r.application);
          return { ok: true, created: r.created, writeBack: r.writeBack };
        } catch (e) {
          return { ok: false, error: (e as Error).message };
        }
      }
      if (persistence.kind === 'loading') return { ok: false, error: 'Persistência ainda carregando; tente novamente.' };
      if (persistence.kind === 'error') return { ok: false, error: persistence.detail };
      if (dataset.applications.some((a) => a.jobId === jobId)) return { ok: true, created: false };
      const app: Application = {
        id: `local-${jobId}`,
        origin: base.origin,
        jobId,
        stage: 'discovered',
        history: [{ stage: 'discovered', at: base.asOf, note: 'Adicionada neste navegador' }],
        nextAction: 'Triagem',
        nextActionDue: null,
        notes: 'Registro somente neste navegador — não persistido no servidor.',
      };
      persist({ ...overlay, added: [...overlay.added, app] });
      return { ok: true, created: true };
    },
    moveApplication: async (appId, stage) => {
      const cur = dataset.applications.find((a) => a.id === appId);
      if (!cur) return { ok: false, error: 'Candidatura não encontrada.' };
      if (cur.stage === stage) return { ok: true };
      if (serverMode) {
        try {
          const r = await api<{ application?: StoredApplication; writeBack: WriteBackInfo }>(`/api/pipeline/${encodeURIComponent(cur.jobId)}`, { method: 'PATCH', body: JSON.stringify({ stage }) });
          if (!r.application) throw new Error('Resposta sem a candidatura gravada');
          upsertStored(r.application);
          return { ok: true, writeBack: r.writeBack };
        } catch (e) {
          return { ok: false, error: (e as Error).message };
        }
      }
      if (persistence.kind === 'loading') return { ok: false, error: 'Persistência ainda carregando; tente novamente.' };
      if (persistence.kind === 'error') return { ok: false, error: persistence.detail };
      const ev: StageEvent = { stage, at: base.asOf, note: 'Movida neste navegador' };
      persist({ ...overlay, moves: { ...overlay.moves, [appId]: [...(overlay.moves[appId] ?? []), ev] } });
      return { ok: true };
    },
    resetLocal: () => persist(EMPTY),
    changeOrigin: (appId) => (persistedIds.has(appId) ? 'persisted' : appId.startsWith('local-') || appId in overlay.moves ? 'local' : null),
    refreshPipeline,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error('useStore outside DataProvider');
  return s;
}
