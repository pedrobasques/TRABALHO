import { Suspense } from 'react';
import { LoadingState } from '@/components/ui/primitives';
import { JobRadar } from './job-radar';

export const metadata = { title: 'Job Radar' };

export default function Page() {
  return (
    <Suspense fallback={<LoadingState rows={8} />}>
      <JobRadar />
    </Suspense>
  );
}
