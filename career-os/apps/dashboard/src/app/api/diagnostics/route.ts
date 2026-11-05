import { NextResponse } from 'next/server';
import { readDiagnosticRuns, runDiagnostics, saveDiagnosticRun } from '@/lib/data.server';

export const dynamic = 'force-dynamic';

export function GET() {
  return NextResponse.json({ runs: readDiagnosticRuns() });
}

/** Runs the fixed local health checks and appends the result to private/diagnostics.jsonl. */
export function POST(req: Request) {
  // same-origin guard: reject cross-site form posts
  const origin = req.headers.get('origin');
  const host = req.headers.get('host');
  if (origin && host && new URL(origin).host !== host) {
    return NextResponse.json({ error: 'cross-origin request rejected' }, { status: 403 });
  }
  const run = runDiagnostics();
  const saved = saveDiagnosticRun(run);
  return NextResponse.json({ run, saved });
}
