'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { isPeriodKey, type PeriodKey } from '@career-os/core';

/** Period selection persisted in the URL (?period=30d) so views are shareable. */
export function usePeriod(fallback: PeriodKey = '30d'): [PeriodKey, (p: PeriodKey) => void] {
  const sp = useSearchParams();
  const router = useRouter();
  const path = usePathname();
  const raw = sp.get('period');
  const period = isPeriodKey(raw) ? raw : fallback;
  const set = (p: PeriodKey) => {
    const next = new URLSearchParams(sp.toString());
    next.set('period', p);
    router.replace(`${path}?${next.toString()}`, { scroll: false });
  };
  return [period, set];
}
