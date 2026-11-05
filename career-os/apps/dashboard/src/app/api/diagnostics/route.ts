import { NextResponse } from 'next/server';
import { readDiagnosticRuns, runDiagnostics, saveDiagnosticRun } from '@/lib/data.server';

export const dynamic = 'force-dynamic';

export function GET() {
  return NextResponse.json({ runs: readDiagnosticRuns() });
}

/** Runs the fixed local health checks and appends the result to private/diagnostics.jsonl. */
export function POST(req: Request) {
  // CSRF: enforced centrally in src/proxy.ts for every mutating request.
  void req;
  const run = runDiagnostics();
  const saved = saveDiagnosticRun(run);
  return NextResponse.json({ run, saved });
}
