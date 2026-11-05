import { getCvTemplates, getSourceStatus } from '@/lib/data.server';
import { CvStudio } from './cv-studio';

export const metadata = { title: 'CV Studio' };

export default function Page() {
  const status = getSourceStatus();
  return <CvStudio templates={getCvTemplates()} files={status.files} />;
}
