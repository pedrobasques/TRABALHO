import { getDataset } from '@/lib/data.server';
import { DataProvider } from '@/lib/store';
import { AppShell } from '@/components/layout/app-shell';
import { resolveAuthConfig } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const dataset = getDataset();
  const authEnabled = resolveAuthConfig(process.env).mode === 'password';
  return (
    <DataProvider dataset={dataset}>
      <AppShell authEnabled={authEnabled}>{children}</AppShell>
    </DataProvider>
  );
}
