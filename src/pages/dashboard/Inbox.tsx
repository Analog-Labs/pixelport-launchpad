import { useMemo, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { formatDistanceToNow, isValid, parseISO } from 'date-fns';
import { ProxyQueryWrapper } from '@/components/dashboard/ProxyQueryWrapper';
import { StatusBadge } from '@/components/dashboard/StatusBadge';
import { usePaperclipTasks } from '@/hooks/usePaperclipTasks';
import type { PaperclipIssue } from '@/lib/paperclip-types';
import { cn } from '@/lib/utils';

type InboxTab = 'recent' | 'unread' | 'all';

function priorityArrow(priority?: string): string {
  if (priority === 'critical') return '↑↑';
  if (priority === 'high') return '↑';
  if (priority === 'low') return '↓';
  return '→';
}

function lastActionLabel(issue: PaperclipIssue): string {
  if (!issue.updatedAt) return 'updated just now';
  const parsed = parseISO(issue.updatedAt);
  if (!isValid(parsed)) return 'updated recently';
  return `updated ${formatDistanceToNow(parsed, { addSuffix: true })}`;
}

export default function Inbox() {
  const [activeTab, setActiveTab] = useState<InboxTab>('recent');
  const recentQuery = usePaperclipTasks();
  const unreadQuery = usePaperclipTasks({ unreadForUserId: 'me' });

  const activeQuery = activeTab === 'unread' ? unreadQuery : recentQuery;

  const issues = useMemo(() => {
    const source = activeTab === 'unread' ? unreadQuery.data?.issues ?? [] : recentQuery.data?.issues ?? [];
    return [...source].sort((left, right) => {
      const leftTime = left.updatedAt ? parseISO(left.updatedAt).getTime() : 0;
      const rightTime = right.updatedAt ? parseISO(right.updatedAt).getTime() : 0;
      return rightTime - leftTime;
    });
  }, [activeTab, recentQuery.data?.issues, unreadQuery.data?.issues]);

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <h1 className="text-2xl font-satoshi font-bold text-foreground">Inbox</h1>

      <div className="inline-flex rounded-lg border border-border bg-card p-1">
        {(['recent', 'unread', 'all'] as InboxTab[]).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={cn(
              'rounded-md px-3 py-1.5 text-sm capitalize transition-colors',
              activeTab === tab
                ? 'bg-zinc-900 text-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      <ProxyQueryWrapper
        query={activeQuery}
        skeleton={
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-14 rounded-lg bg-amber-500/5 animate-pulse" />
            ))}
          </div>
        }
        errorLabel="inbox"
      >
        {() => {
          if (!issues.length) {
            return (
              <div className="rounded-xl border border-border bg-card p-10 text-center space-y-2">
                <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-400" />
                <p className="text-muted-foreground">All caught up — no updates.</p>
              </div>
            );
          }

          return (
            <div className="space-y-2">
              {issues.map((issue) => (
                <div
                  key={issue.id}
                  className="grid min-h-[44px] grid-cols-[auto_auto_1fr_auto] items-center gap-3 rounded-xl border border-border bg-card px-3 py-2"
                >
                  <span className="w-6 text-center font-mono text-[11px] text-amber-400">
                    {priorityArrow(issue.priority)}
                  </span>
                  <span
                    className={cn(
                      'h-2 w-2 rounded-full',
                      issue.status === 'done' ? 'bg-emerald-500' : issue.status === 'in_progress' ? 'bg-amber-500' : 'bg-zinc-500',
                    )}
                  />
                  <div className="min-w-0">
                    <p className="truncate text-sm text-foreground">
                      <span className="mr-2 font-mono text-[11px] text-muted-foreground">
                        {issue.identifier ?? (issue.number ? `#${issue.number}` : issue.id.slice(0, 6))}
                      </span>
                      {issue.title}
                    </p>
                    <p className="font-mono text-[11px] text-muted-foreground/70">{lastActionLabel(issue)}</p>
                  </div>
                  <StatusBadge status={issue.status} />
                </div>
              ))}
            </div>
          );
        }}
      </ProxyQueryWrapper>
    </div>
  );
}
