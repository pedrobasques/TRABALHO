import 'server-only';
import { loadDataset, careerOpsDataPresent, resolveSource, careerOpsRoot } from '@career-os/core/server';

export function getDataset() {
  return loadDataset();
}

export function getSourceStatus() {
  return { active: resolveSource(), setting: process.env.CAREER_OS_DATA_SOURCE ?? 'auto', root: careerOpsRoot(), files: careerOpsDataPresent() };
}
