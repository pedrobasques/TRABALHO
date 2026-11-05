import { Suspense } from 'react';
import { LoadingState } from '@/components/ui/primitives';
import { Pipeline } from './pipeline';

export const metadata = { title: 'Pipeline' };

export default function Page() {
  return (
    <Suspense fallback={<LoadingState rows={8} />}>
      <Pipeline />
    </Suspense>
  );
}
