import { Suspense } from 'react';
import { LoadingState } from '@/components/ui/primitives';
import { CommandCenter } from './command-center';

export const metadata = { title: 'Command Center' };

export default function Page() {
  return (
    <Suspense fallback={<LoadingState rows={8} />}>
      <CommandCenter />
    </Suspense>
  );
}
