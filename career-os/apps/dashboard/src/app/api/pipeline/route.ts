import { NextResponse } from 'next/server';
import { getDataset } from '@/lib/data.server';
import { errorBody, getPipelineStore, httpStatusFor, seedFrom } from '@/lib/pipeline.server';

export const dynamic = 'force-dynamic';

/** Lists persisted applications and the persistence status. */
export async function GET() {
  const ds = getDataset();
  const { store, status } = await getPipelineStore(ds.origin);
  if (!store) return NextResponse.json({ status, applications: [] });
  try {
    return NextResponse.json({ status, applications: await store.list() });
  } catch (e) {
    return NextResponse.json({ status, ...errorBody(e) }, { status: httpStatusFor(e) });
  }
}

/** Adds a job (looked up server-side — the client never supplies job data) to the pipeline. Idempotent. */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { jobId?: unknown } | null;
  const jobId = typeof body?.jobId === 'string' ? body.jobId : '';
  if (!jobId || jobId.length > 200) return NextResponse.json({ error: 'jobId inválido', code: 'invalid_input' }, { status: 400 });
  const ds = getDataset();
  const job = ds.jobs.find((j) => j.id === jobId);
  if (!job) return NextResponse.json({ error: 'Vaga não encontrada', code: 'not_found' }, { status: 404 });
  const { store, status } = await getPipelineStore(ds.origin);
  if (!store) return NextResponse.json({ status, error: status.detail, code: 'unavailable' }, { status: 503 });
  try {
    const base = ds.applications.find((a) => a.jobId === jobId);
    const seedHistory = seedFrom(base);
    const r = await store.add(job, seedHistory ? { seedHistory } : {});
    return NextResponse.json({ status, ...r }, { status: r.created ? 201 : 200 });
  } catch (e) {
    return NextResponse.json({ status, ...errorBody(e) }, { status: httpStatusFor(e) });
  }
}
