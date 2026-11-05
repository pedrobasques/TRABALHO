import type { Metadata, Viewport } from 'next';
import './globals.css';
import { getDataset } from '@/lib/data.server';
import { DataProvider } from '@/lib/store';
import { AppShell } from '@/components/layout/app-shell';
import { ToastProvider } from '@/components/ui/toast';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: { default: 'Career OS', template: '%s · Career OS' },
  description: 'Centro de comando pessoal de carreira e candidaturas.',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: '#0a0f1c',
  width: 'device-width',
  initialScale: 1,
};

const THEME_SCRIPT = `try{var t=localStorage.getItem('career-os:theme');if(t==='light')document.documentElement.dataset.theme='light'}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const dataset = getDataset();
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>
        <ToastProvider>
          <DataProvider dataset={dataset}>
            <AppShell>{children}</AppShell>
          </DataProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
