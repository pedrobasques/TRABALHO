import { Suspense } from 'react';
import { LoadingState } from '@/components/ui/primitives';
import { Analytics } from './analytics';

export const metadata = { title: 'Analytics & Reports' };

export default function Page() {
  return (
    <Suspense fallback={<LoadingState rows={8} />}>
      <Analytics />
    </Suspense>
  );
}
