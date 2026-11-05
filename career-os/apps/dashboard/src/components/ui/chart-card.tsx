import type { ReactNode } from 'react';
import { Card, CardHeader } from './primitives';

/** Card wrapper for charts: every chart states the question it answers. */
export function ChartCard({ title, question, children, action, className, testId }: { title: string; question: string; children: ReactNode; action?: ReactNode; className?: string; testId?: string }) {
  return (
    <Card className={className} data-testid={testId}>
      <CardHeader title={title} subtitle={question} action={action} />
      <div className="px-5 pb-5">{children}</div>
    </Card>
  );
}
