import { NextResponse } from 'next/server';
import { PipelineError, isStage } from '@career-os/core';
import { getDataset } from '@/lib/data.server';
import { errorBody, getPipelineStore, httpStatusFor, seedFrom, writeBack } from '@/lib/pipeline.server';

export const dynamic = 'force-dynamic';

/**
 * Moves an application to another stage. If the job is tracked by the data source
 * (career-ops tracker / demo) but not yet in the store, it is adopted first with its
 * existing history, so nothing is lost.
 */
export async function PATCH(req: Request, ctx: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await ctx.params;
  const body = (await req.json().catch(() => null)) as { stage?: unknown; note?: unknown } | null;
  if (!isStage(body?.stage)) return NextResponse.json({ error: 'Etapa inválida', code: 'invalid_stage' }, { status: 400 });
  const note = typeof body?.note === 'string' ? body.note.slice(0, 500) : undefined;
  const ds = await getDataset();
  const { store, status } = await getPipelineStore(ds.origin);
  if (!store) return NextResponse.json({ status, error: status.detail, code: 'unavailable' }, { status: 503 });
  try {
    const respond = async () => {
      // the journal write already succeeded here; write-back failures are reported, not hidden
      const wb = await writeBack(store, jobId).catch((err: Error) => ({ attempted: true, applied: 0, notApplicable: 0, failed: 1, detail: `Falha ao gravar no tracker: ${err.message}` }));
      const application = (await store.list()).find((a) => a.job.jobId === jobId);
      return NextResponse.json({ status, application, writeBack: wb });
    };
    try {
      await store.move(jobId, body.stage, note);
      return await respond();
    } catch (e) {
      if (!(e instanceof PipelineError && e.code === 'not_found')) throw e;
      const job = ds.jobs.find((j) => j.id === jobId);
      const base = ds.applications.find((a) => a.jobId === jobId);
      if (!job || !base) throw e;
      const seedHistory = seedFrom(base);
      await store.add(job, seedHistory ? { seedHistory } : {});
      await store.move(jobId, body.stage, note);
      return await respond();
    }
  } catch (e) {
    return NextResponse.json({ status, ...errorBody(e) }, { status: httpStatusFor(e) });
  }
}
