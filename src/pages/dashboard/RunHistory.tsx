import { useState } from 'react';
import { CheckCircle2, XCircle, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';
import { usePaperclipRuns, usePaperclipRunDetail, usePaperclipRunEvents } from '@/hooks/usePaperclipRuns';
import { ProxyQueryWrapper } from '@/components/dashboard/ProxyQueryWrapper';
import { RunHistorySkeleton } from '@/components/dashboard/DashboardSkeleton';
import { getCostColor, formatCostCents, formatDurationMs } from '@/lib/costColoring';
import type { HeartbeatRun } from '@/lib/paperclip-types';
import { humanizeToken } from '@/lib/paperclip-normalize';
import { cn } from '@/lib/utils';
import { formatDistanceToNow, isValid, parseISO } from 'date-fns';

// ── Run detail panel ───────────────────────────────────────────────────────────

function RunDetail({ runId }: { runId: string }) {
  const detailQuery = usePaperclipRunDetail(runId);
  const eventsQuery = usePaperclipRunEvents(runId);

  if (detailQuery.isLoading || eventsQuery.isLoading) {
    return (
      <div className="px-4 pb-4 space-y-2 animate-pulse">
        <div className="h-3 bg-amber-500/5 rounded w-3/4" />
        <div className="h-3 bg-amber-500/5 rounded w-1/2" />
      </div>
    );
  }

  return (
    <div className="px-4 pb-4 space-y-3 border-t border-border pt-3">
      {detailQuery.data?.name && (
        <p className="text-sm font-satoshi text-foreground">{detailQuery.data.name}</p>
      )}
      {eventsQuery.data?.events?.length ? (
        <div className="space-y-1.5">
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60">Events</p>
          {eventsQuery.data.events.map((evt) => (
            <div key={evt.id} className="font-mono text-[11px] text-muted-foreground flex gap-2">
              <span className="text-muted-foreground/60">
                {(() => { const d = parseISO(evt.createdAt); return isValid(d) ? formatDistanceToNow(d, { addSuffix: true }) : ''; })()}
              </span>
              <span>{humanizeToken(evt.type)}</span>
              {evt.message && <span className="text-zinc-500 truncate">— {evt.message}</span>}
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-1">
          <p className="font-mono text-[11px] text-muted-foreground/60">No timeline events recorded yet.</p>
          {detailQuery.data?.error && (
            <p className="font-mono text-[11px] text-red-300/80 truncate">
              Last error: {detailQuery.data.error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Run row ────────────────────────────────────────────────────────────────────

function RunRow({ run, budgetCents }: { run: HeartbeatRun; budgetCents?: number }) {
  const [expanded, setExpanded] = useState(false);
  const cost = run.costCents ?? 0;
  const { textClass, bgClass } = getCostColor(cost, budgetCents);
  const success = run.result === 'success';

  return (
    <div className={cn('border-b border-border last:border-0 transition-colors', bgClass)}>
      {/* Row summary */}
      <button
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-zinc-800/30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-amber-400/40"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        {success ? (
          <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
        ) : (
          <XCircle className="h-4 w-4 text-red-400 shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <span className="font-satoshi text-sm text-foreground truncate block">
            {run.name ?? run.id.slice(0, 12)}
          </span>
          {run.wakeReason && (
            <span className="font-mono text-[10px] text-muted-foreground/60 truncate block">
              Wake: {humanizeToken(run.wakeReason)}
            </span>
          )}
        </div>
        {run.durationMs != null && (
          <span className="font-mono text-[11px] text-muted-foreground shrink-0">
            {formatDurationMs(run.durationMs)}
          </span>
        )}
        <span className={cn('font-mono text-[11px] shrink-0', textClass)}>
          {formatCostCents(cost)}
        </span>
        <span className="font-mono text-[11px] text-muted-foreground/60 shrink-0">
          {(() => { const d = parseISO(run.startedAt); return isValid(d) ? formatDistanceToNow(d, { addSuffix: true }) : ''; })()}
        </span>
        {expanded ? (
          <ChevronUp className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        )}
      </button>

      {/* Expandable detail */}
      {expanded && <RunDetail runId={run.id} />}
    </div>
  );
}

// ── Run history page ───────────────────────────────────────────────────────────

export default function RunHistory() {
  const runHistoryQuery = usePaperclipRuns();

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-satoshi font-bold text-foreground">Run History</h1>
        <button
          onClick={() => runHistoryQuery.refetch()}
          className="flex items-center gap-1.5 text-xs font-mono text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/40 rounded px-1.5 py-0.5"
          disabled={runHistoryQuery.isFetching}
        >
          <RefreshCw className={cn('h-3.5 w-3.5', runHistoryQuery.isFetching && 'animate-spin')} />
          Refresh
        </button>
      </div>

      <ProxyQueryWrapper
        query={runHistoryQuery}
        skeleton={<RunHistorySkeleton />}
        errorLabel="run history"
      >
        {(data) => {
          if (!data.runs.length) {
            return (
              <div className="rounded-xl border border-border bg-card p-10 text-center space-y-2">
                <RefreshCw className="h-8 w-8 text-muted-foreground mx-auto" />
                <p className="text-muted-foreground">
                  No runs yet — your Chief hasn't started.
                </p>
              </div>
            );
          }

          return (
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              {/* Column headers */}
              <div className="flex items-center gap-3 px-4 py-2 border-b border-border bg-zinc-900/50">
                <div className="w-4" />
                <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60 flex-1">
                  Run
                </span>
                <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60 w-12 text-right">
                  Duration
                </span>
                <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60 w-14 text-right">
                  Cost
                </span>
                <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60 w-24 text-right">
                  When
                </span>
                <div className="w-3.5" />
              </div>
              {data.runs.map((run) => (
                <RunRow key={run.id} run={run} />
              ))}
            </div>
          );
        }}
      </ProxyQueryWrapper>
    </div>
  );
}
