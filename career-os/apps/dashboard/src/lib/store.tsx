'use client';

/**
 * Client data store. Holds the dataset delivered by the server plus a LOCAL
 * overlay (favorites, demo pipeline moves, jobs sent to the pipeline) kept in
 * this browser's localStorage only. Overlay changes are never written to
 * career-ops files or any server, and the UI labels them as local.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { matchAll, type Application, type Dataset, type MatchResult, type PipelineStage, type StageEvent } from '@career-os/core';

const KEY = 'career-os:local-overlay:v1';

interface Overlay {
  favorites: string[];
  added: Application[];
  moves: Record<string, StageEvent[]>;
}
const EMPTY: Overlay = { favorites: [], added: [], moves: {} };

interface Store {
  base: Dataset;
  dataset: Dataset;
  matches: Map<string, MatchResult>;
  overlay: Overlay;
  hydrated: boolean;
  localChanges: number;
  isFavorite: (jobId: string) => boolean;
  toggleFavorite: (jobId: string) => void;
  addToPipeline: (jobId: string) => Application | null;
  moveApplication: (appId: string, stage: PipelineStage) => void;
  resetLocal: () => void;
  isLocal: (appId: string) => boolean;
}

const Ctx = createContext<Store | null>(null);

function today(asOf: string): string {
  // Demo data lives on a fixed reference date; real data uses the actual day.
  return asOf;
}

export function DataProvider({ dataset: base, children }: { dataset: Dataset; children: React.ReactNode }) {
  const [overlay, setOverlay] = useState<Overlay>(EMPTY);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(`${KEY}:${base.origin}`);
      if (raw) setOverlay({ ...EMPTY, ...(JSON.parse(raw) as Overlay) });
    } catch {
      /* storage unavailable — overlay stays empty */
    }
    setHydrated(true);
  }, [base.origin]);

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

  const dataset = useMemo<Dataset>(() => {
    const apps = [...base.applications, ...overlay.added].map((a) => {
      const extra = overlay.moves[a.id];
      if (!extra?.length) return a;
      const history = [...a.history, ...extra];
      return { ...a, history, stage: history[history.length - 1]!.stage };
    });
    return { ...base, applications: apps };
  }, [base, overlay]);

  const matches = useMemo(() => matchAll(base.jobs, base.profile), [base]);

  const value: Store = {
    base,
    dataset,
    matches,
    overlay,
    hydrated,
    localChanges: overlay.favorites.length + overlay.added.length + Object.keys(overlay.moves).length,
    isFavorite: (id) => overlay.favorites.includes(id),
    toggleFavorite: (id) =>
      persist({ ...overlay, favorites: overlay.favorites.includes(id) ? overlay.favorites.filter((x) => x !== id) : [...overlay.favorites, id] }),
    addToPipeline: (jobId) => {
      if (dataset.applications.some((a) => a.jobId === jobId)) return null;
      const app: Application = {
        id: `local-${jobId}`,
        origin: base.origin,
        jobId,
        stage: 'discovered',
        history: [{ stage: 'discovered', at: today(base.asOf), note: 'Adicionada localmente' }],
        nextAction: 'Triagem',
        nextActionDue: null,
        notes: 'Registro local (este navegador) — não persistido.',
      };
      persist({ ...overlay, added: [...overlay.added, app] });
      return app;
    },
    moveApplication: (appId, stage) => {
      const cur = dataset.applications.find((a) => a.id === appId);
      if (!cur || cur.stage === stage) return;
      const ev: StageEvent = { stage, at: today(base.asOf), note: 'Movida localmente' };
      persist({ ...overlay, moves: { ...overlay.moves, [appId]: [...(overlay.moves[appId] ?? []), ev] } });
    },
    resetLocal: () => persist(EMPTY),
    isLocal: (appId) => appId.startsWith('local-') || appId in overlay.moves,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error('useStore outside DataProvider');
  return s;
}
