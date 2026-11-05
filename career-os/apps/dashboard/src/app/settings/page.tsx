import { getSourceStatus } from '@/lib/data.server';
import { SettingsView } from './settings-view';

export const metadata = { title: 'Configurações' };

export default function Page() {
  return <SettingsView status={getSourceStatus()} />;
}
