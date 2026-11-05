import { readDiagnosticRuns, readIngestRuns } from '@/lib/data.server';
import { AutomationCenter } from './automation-center';

export const metadata = { title: 'Automation Center' };

export default function Page() {
  return <AutomationCenter initialRuns={readDiagnosticRuns()} ingestRuns={readIngestRuns()} />;
}
