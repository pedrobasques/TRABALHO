import { NextResponse } from 'next/server';
import { getDataset } from '@/lib/data.server';
import { errorBody, getPipelineStore, httpStatusFor } from '@/lib/pipeline.server';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, ctx: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await ctx.params;
  const ds = getDataset();
  const { store, status } = await getPipelineStore(ds.origin);
  if (!store) return NextResponse.json({ status, error: status.detail, code: 'unavailable' }, { status: 503 });
  try {
    return NextResponse.json({ status, events: await store.events(jobId) });
  } catch (e) {
    return NextResponse.json({ status, ...errorBody(e) }, { status: httpStatusFor(e) });
  }
}
