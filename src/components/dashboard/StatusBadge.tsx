import { cn } from '@/lib/utils';

function statusTone(status?: string): string {
  const normalized = status?.toLowerCase();

  if (
    normalized === 'done'
    || normalized === 'complete'
    || normalized === 'completed'
    || normalized === 'success'
    || normalized === 'online'
  ) {
    return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400';
  }

  if (
    normalized === 'in_progress'
    || normalized === 'in progress'
    || normalized === 'running'
    || normalized === 'in_review'
    || normalized === 'pending'
    || normalized === 'blocked'
  ) {
    return 'border-amber-400/30 bg-amber-500/10 text-amber-400';
  }

  if (normalized === 'failed' || normalized === 'error' || normalized === 'offline') {
    return 'border-red-500/30 bg-red-500/10 text-red-300';
  }

  return 'border-border bg-zinc-800 text-muted-foreground';
}

function label(status?: string): string {
  if (!status) return 'Unknown';
  return status.replace(/_/g, ' ');
}

export function StatusBadge({
  status,
  className,
}: {
  status?: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-mono',
        statusTone(status),
        className,
      )}
    >
      {label(status)}
    </span>
  );
}
