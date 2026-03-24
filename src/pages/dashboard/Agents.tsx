import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, XCircle } from 'lucide-react';
import { usePaperclipAgents, usePaperclipAgentRuns, usePaperclipLiveRuns } from '@/hooks/usePaperclipAgents';
import { useWakeAgent } from '@/hooks/usePaperclipAgentDetail';
import { ProxyQueryWrapper } from '@/components/dashboard/ProxyQueryWrapper';
import { AgentInvokeButton } from '@/components/dashboard/AgentInvokeButton';
import { AgentCardSkeleton } from '@/components/dashboard/DashboardSkeleton';
import { Button } from '@/components/ui/button';
import { formatCostCents, formatDurationMs } from '@/lib/costColoring';
import { useAuth } from '@/contexts/AuthContext';
import { launchChiefWorkspace } from '@/lib/runtime-launch';
import type { HeartbeatRun, PaperclipAgent } from '@/lib/paperclip-types';
import { cn } from '@/lib/utils';
import { formatDistanceToNow, isValid, parseISO } from 'date-fns';
import { toast } from 'sonner';
import { resolveAgentDisplayName } from '@/lib/agent-display';
import { AgentPulseDot } from '@/components/dashboard/AgentPulseDot';

function RunTimelineEntry({ run }: { run: HeartbeatRun }) {
  const success = run.result === 'success';
  return (
    <div className="flex items-center gap-2 font-mono text-[11px] text-muted-foreground">
      {success ? (
        <CheckCircle2 className="h-3 w-3 text-emerald-400 shrink-0" />
      ) : (
        <XCircle className="h-3 w-3 text-red-400 shrink-0" />
      )}
      <span className="truncate flex-1">{run.name ?? 'Run'}</span>
      {run.durationMs != null && (
        <span className="shrink-0">{formatDurationMs(run.durationMs)}</span>
      )}
      {run.costCents != null && (
        <span className="shrink-0">{formatCostCents(run.costCents)}</span>
      )}
      <span className="shrink-0 text-muted-foreground/60">
        {(() => { const d = parseISO(run.startedAt); return isValid(d) ? formatDistanceToNow(d, { addSuffix: true }) : ''; })()}
      </span>
    </div>
  );
}

function AgentActivityTimeline({ agentId }: { agentId: string }) {
  const query = usePaperclipAgentRuns(agentId, 3);

  if (query.isLoading) {
    return (
      <div className="space-y-1">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-3 rounded bg-amber-500/5 animate-pulse" />
        ))}
      </div>
    );
  }

  if (!query.data?.runs?.length) {
    return (
      <p className="font-mono text-[11px] text-muted-foreground/60">No activity yet</p>
    );
  }

  return (
    <div className="space-y-1.5">
      {query.data.runs.map((run) => (
        <RunTimelineEntry key={run.id} run={run} />
      ))}
    </div>
  );
}

function AgentCard({
  agent,
  displayName,
  onOpenChief,
  onRunNow,
  opening,
  runPending,
}: {
  agent: PaperclipAgent;
  displayName: string;
  onOpenChief: () => void;
  onRunNow: () => void;
  opening: boolean;
  runPending: boolean;
}) {
  const budgetPct =
    agent.budgetLimitCents && agent.budgetLimitCents > 0
      ? Math.min(100, ((agent.budgetUsedCents ?? 0) / agent.budgetLimitCents) * 100)
      : 0;

  const budgetColor =
    budgetPct >= 80 ? 'bg-red-500' : budgetPct >= 50 ? 'bg-amber-500' : 'bg-emerald-500';

  const statusLabel =
    agent.status === 'online'
      ? 'Online'
      : agent.status === 'running'
        ? 'Running'
        : agent.status === 'error'
          ? 'Error'
          : 'Offline';

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4 transition-all duration-200 hover:border-amber-400/40 hover:shadow-[0_0_20px_rgba(212,168,83,0.08)]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <AgentPulseDot status={agent.status} />
          <Link
            to={`/dashboard/agents/${agent.id}`}
            className="rounded font-satoshi text-base font-bold text-foreground transition-colors hover:text-amber-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/40"
            title="Open agent detail"
          >
            {displayName}
          </Link>
        </div>
        <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
          {statusLabel}
        </span>
      </div>

      {/* Current task */}
      {agent.currentTask ? (
        <p className="text-sm text-muted-foreground truncate">"{agent.currentTask}"</p>
      ) : (
        <p className="text-sm text-muted-foreground/60 italic">Idle</p>
      )}

      {/* Activity timeline */}
      <div>
        <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60 mb-1.5">
          Recent Activity
        </p>
        <AgentActivityTimeline agentId={agent.id} />
      </div>

      {/* Budget bar */}
      {agent.budgetLimitCents ? (
        <div className="space-y-1">
          <div className="flex justify-between font-mono text-[11px] text-muted-foreground">
            <span>Budget</span>
            <span>
              {formatCostCents(agent.budgetUsedCents ?? 0)} / {formatCostCents(agent.budgetLimitCents)}
            </span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-zinc-800 overflow-hidden">
            <div
              className={cn('h-full rounded-full transition-all', budgetColor)}
              style={{ width: `${budgetPct}%` }}
            />
          </div>
        </div>
      ) : null}

      <div className="flex items-center justify-end gap-2">
        <Button
          size="sm"
          variant="ghost"
          onClick={onOpenChief}
          disabled={opening}
          className="min-h-[40px] sm:min-h-0"
        >
          {opening ? 'Opening...' : 'Open Workspace'}
        </Button>
        <AgentInvokeButton label="Run Now" onClick={onRunNow} pending={runPending} />
      </div>
    </div>
  );
}

export default function Agents() {
  const { tenant, session } = useAuth();
  const agentsQuery = usePaperclipAgents();
  const liveRunsQuery = usePaperclipLiveRuns();
  const wakeAgent = useWakeAgent();
  const [openingAgentId, setOpeningAgentId] = useState<string | null>(null);

  const activeRunByAgentId = useMemo(() => {
    const map = new Map<string, { description?: string }>();
    for (const run of liveRunsQuery.data?.runs ?? []) {
      map.set(run.agentId, { description: run.description });
    }
    return map;
  }, [liveRunsQuery.data?.runs]);
  const preferredChiefName =
    typeof tenant?.onboarding_data?.agent_name === 'string'
      ? tenant.onboarding_data.agent_name
      : undefined;
  const accessToken = session?.access_token ?? '';

  const handleOpenChief = async (agentId: string) => {
    if (!accessToken) {
      toast.error('Session expired. Please sign in again.');
      return;
    }

    try {
      setOpeningAgentId(agentId);
      await launchChiefWorkspace(accessToken, 'dashboard_agents_card');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to open Chief workspace');
    } finally {
      setOpeningAgentId(null);
    }
  };

  const handleRunNow = (agentId: string) => {
    wakeAgent.mutate(
      { agentId },
      {
        onSuccess: () => toast.success('Agent nudged — check runs'),
        onError: (error) => {
          toast.error(error instanceof Error ? error.message : 'Failed to wake agent');
        },
      },
    );
  };

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <h1 className="text-2xl font-satoshi font-bold text-foreground">Agents</h1>

      <ProxyQueryWrapper
        query={agentsQuery}
        skeleton={
          <div className="grid sm:grid-cols-2 gap-4">
            <AgentCardSkeleton />
            <AgentCardSkeleton />
          </div>
        }
        errorLabel="agents"
      >
        {(data) => {
          if (!data.agents.length) {
            return (
              <div className="rounded-xl border border-border bg-card p-10 text-center">
                <p className="text-muted-foreground">No agents provisioned.</p>
              </div>
            );
          }
          return (
            <div className="grid sm:grid-cols-2 gap-4">
              {data.agents.map((agent) => {
                const liveRun = activeRunByAgentId.get(agent.id);
                const status = liveRun ? 'running' : agent.status;
                const currentTask = liveRun?.description || agent.currentTask;
                return (
                  <AgentCard
                    key={agent.id}
                    agent={{ ...agent, status, currentTask }}
                    displayName={resolveAgentDisplayName(agent, preferredChiefName)}
                    onOpenChief={() => handleOpenChief(agent.id)}
                    onRunNow={() => handleRunNow(agent.id)}
                    opening={openingAgentId === agent.id}
                    runPending={wakeAgent.isPending && wakeAgent.variables?.agentId === agent.id}
                  />
                );
              })}
            </div>
          );
        }}
      </ProxyQueryWrapper>
    </div>
  );
}
