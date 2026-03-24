import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { formatDistanceToNow, isValid, parseISO } from 'date-fns';
import { ProxyQueryWrapper } from '@/components/dashboard/ProxyQueryWrapper';
import { AgentInvokeButton } from '@/components/dashboard/AgentInvokeButton';
import { CreateTaskPanel } from '@/components/dashboard/CreateTaskPanel';
import { StatusBadge } from '@/components/dashboard/StatusBadge';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { usePaperclipAgents, usePaperclipAgentRuns } from '@/hooks/usePaperclipAgents';
import {
  usePaperclipAgentDetail,
  usePaperclipAgentIssues,
  useWakeAgent,
} from '@/hooks/usePaperclipAgentDetail';
import { usePaperclipCostsByAgent } from '@/hooks/usePaperclipCosts';
import { formatCostCents, formatDurationMs } from '@/lib/costColoring';
import { launchChiefWorkspace } from '@/lib/runtime-launch';
import { toast } from 'sonner';

function timeAgo(value?: string): string {
  if (!value) return '—';
  const parsed = parseISO(value);
  return isValid(parsed) ? formatDistanceToNow(parsed, { addSuffix: true }) : '—';
}

export default function AgentDetail() {
  const { agentId = '' } = useParams();
  const { session } = useAuth();
  const [createPanelOpen, setCreatePanelOpen] = useState(false);
  const detailQuery = usePaperclipAgentDetail(agentId);
  const runsQuery = usePaperclipAgentRuns(agentId, 1);
  const issuesQuery = usePaperclipAgentIssues(agentId);
  const costsQuery = usePaperclipCostsByAgent();
  const agentsQuery = usePaperclipAgents();
  const wakeAgent = useWakeAgent();

  const costEntry = useMemo(() => {
    return (costsQuery.data?.agents ?? []).find((entry) => entry.agentId === agentId);
  }, [agentId, costsQuery.data?.agents]);

  const handleWake = () => {
    wakeAgent.mutate(
      { agentId },
      {
        onSuccess: () => toast.success('Agent nudged — check runs'),
        onError: (error) => toast.error(error instanceof Error ? error.message : 'Failed to wake agent'),
      },
    );
  };

  const handleWorkspace = async () => {
    const token = session?.access_token ?? '';
    if (!token) {
      toast.error('Session expired. Please sign in again.');
      return;
    }
    try {
      await launchChiefWorkspace(token, 'dashboard_agent_detail');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to open workspace');
    }
  };

  if (!agentId) {
    return <p className="text-sm text-muted-foreground">Missing agent id.</p>;
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <div className="md:hidden rounded-lg border border-amber-400/30 bg-amber-500/5 p-3 text-sm text-muted-foreground">
        Best viewed on desktop.
      </div>

      <ProxyQueryWrapper
        query={detailQuery}
        skeleton={<div className="h-40 rounded-xl bg-amber-500/5 animate-pulse" />}
        errorLabel="agent detail"
      >
        {(agent) => (
          <div className="rounded-xl border border-border bg-card p-5 space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-2xl font-satoshi font-bold text-foreground">{agent.name}</p>
                <p className="text-sm text-muted-foreground">{agent.role ?? 'Agent'}</p>
              </div>
              <StatusBadge status={agent.status} />
            </div>

            <div className="flex flex-wrap gap-2">
              <AgentInvokeButton
                label="Run Now"
                onClick={handleWake}
                pending={wakeAgent.isPending}
              />
              <Button
                variant="outline"
                onClick={() => setCreatePanelOpen(true)}
                className="min-h-[40px] sm:min-h-0"
              >
                Assign Task
              </Button>
              <Button
                variant="ghost"
                onClick={handleWorkspace}
                className="min-h-[40px] sm:min-h-0"
              >
                Open Workspace
              </Button>
            </div>
          </div>
        )}
      </ProxyQueryWrapper>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">Latest Run</p>
          {runsQuery.data?.runs?.[0] ? (
            <div className="mt-3 space-y-2">
              <StatusBadge status={runsQuery.data.runs[0].status ?? runsQuery.data.runs[0].result} />
              <p className="text-sm text-foreground">Run ID: {runsQuery.data.runs[0].id}</p>
              <p className="text-sm text-muted-foreground">When: {timeAgo(runsQuery.data.runs[0].startedAt)}</p>
              {runsQuery.data.runs[0].durationMs != null ? (
                <p className="text-sm text-muted-foreground">
                  Duration: {formatDurationMs(runsQuery.data.runs[0].durationMs)}
                </p>
              ) : null}
            </div>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">No runs yet — click Run Now.</p>
          )}
        </div>

        <div className="rounded-xl border border-border bg-card p-5 lg:col-span-2">
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">Recent Issues</p>
            <Link to="/dashboard/tasks" className="text-sm text-amber-400 hover:text-amber-300">
              Open Tasks
            </Link>
          </div>
          {issuesQuery.data?.issues?.length ? (
            <div className="space-y-2">
              {issuesQuery.data.issues.slice(0, 6).map((issue) => (
                <div key={issue.id} className="rounded-lg border border-border bg-card/60 px-3 py-2">
                  <p className="truncate text-sm text-foreground">{issue.title}</p>
                  <div className="mt-1 flex items-center justify-between">
                    <StatusBadge status={issue.status} />
                    <p className="font-mono text-[11px] text-muted-foreground">{timeAgo(issue.updatedAt)}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No tasks assigned.</p>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">Cost Summary</p>
        {costEntry ? (
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            <div>
              <p className="text-sm text-muted-foreground">Spend</p>
              <p className="text-base font-semibold text-foreground">{formatCostCents(costEntry.costCents)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Input tokens</p>
              <p className="text-base font-semibold text-foreground">{costEntry.inputTokens.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Output tokens</p>
              <p className="text-base font-semibold text-foreground">{costEntry.outputTokens.toLocaleString()}</p>
            </div>
          </div>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">No cost data yet — your agent hasn&apos;t run yet.</p>
        )}
      </div>

      <CreateTaskPanel
        open={createPanelOpen}
        onClose={() => setCreatePanelOpen(false)}
        agents={agentsQuery.data?.agents ?? []}
        defaultAssigneeAgentId={agentId}
      />
    </div>
  );
}
