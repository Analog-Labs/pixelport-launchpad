import type { PaperclipAgent } from '@/lib/paperclip-types';
import { cn } from '@/lib/utils';

export function AgentPulseDot({ status }: { status: PaperclipAgent['status'] }) {
  const color =
    status === 'online'
      ? 'bg-emerald-500'
      : status === 'running'
        ? 'bg-amber-500'
        : 'bg-red-500';

  const pulse = status === 'online' || status === 'running';

  return (
    <span className="relative inline-flex h-2.5 w-2.5 shrink-0">
      <span
        className={cn(
          'absolute inline-flex h-full w-full rounded-full opacity-75',
          color,
          pulse && 'animate-ping',
        )}
      />
      <span className={cn('relative inline-flex h-2.5 w-2.5 rounded-full', color)} />
    </span>
  );
}
