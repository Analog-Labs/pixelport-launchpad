import { formatDistanceToNow, isValid, parseISO } from 'date-fns';
import type { ActivityEntry } from '@/lib/paperclip-types';

function entryText(entry: ActivityEntry): string {
  const actor = entry.actorType === 'agent' ? 'Agent' : entry.actorType === 'user' ? 'User' : 'System';
  return `${actor} ${entry.action}`;
}

export function ActivityTimeline({
  entries,
  emptyLabel = 'No activity yet.',
}: {
  entries: ActivityEntry[];
  emptyLabel?: string;
}) {
  if (!entries.length) {
    return <p className="text-sm text-muted-foreground">{emptyLabel}</p>;
  }

  return (
    <div className="space-y-3">
      {entries.map((entry) => (
        <div key={entry.id} className="rounded-lg border border-border bg-card/60 px-3 py-2">
          <p className="text-sm text-foreground">{entryText(entry)}</p>
          <p className="font-mono text-[11px] text-muted-foreground/60">
            {(() => {
              const value = parseISO(entry.createdAt);
              return isValid(value) ? formatDistanceToNow(value, { addSuffix: true }) : 'just now';
            })()}
          </p>
        </div>
      ))}
    </div>
  );
}
