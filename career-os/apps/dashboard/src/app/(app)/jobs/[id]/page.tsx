import { notFound } from 'next/navigation';
import { getDataset } from '@/lib/data.server';
import { JobDetail } from './job-detail';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const job = getDataset().jobs.find((j) => j.id === id);
  return { title: job ? `${job.title} · ${job.company}` : 'Vaga' };
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!getDataset().jobs.some((j) => j.id === id)) notFound();
  return <JobDetail id={id} />;
}
