import { Link } from 'react-router-dom';
import { CheckSquare, ListTodo, BrainCircuit } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useSidebarBadges } from '@/hooks/useSidebarBadges';
import { usePaperclipAgents } from '@/hooks/usePaperclipAgents';
import { usePaperclipDashboard } from '@/hooks/usePaperclipDashboard';
import { ProxyQueryWrapper } from '@/components/dashboard/ProxyQueryWrapper';
import { AgentCardSkeleton, HomeSkeleton } from '@/components/dashboard/DashboardSkeleton';
import { Button } from '@/components/ui/button';
import { formatCostCents } from '@/lib/costColoring';
import { launchChiefWorkspace } from '@/lib/runtime-launch';
import type { PaperclipAgent } from '@/lib/paperclip-types';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useState } from 'react';
import { resolveAgentDisplayName } from '@/lib/agent-display';
import { AgentPulseDot } from '@/components/dashboard/AgentPulseDot';

function AgentSummaryCard({
  agent,
  displayName,
  onOpenChief,
  opening,
}: {
  agent: PaperclipAgent;
  displayName: string;
  onOpenChief: () => void;
  opening: boolean;
}) {
  const budgetPct =
    agent.budgetLimitCents && agent.budgetLimitCents > 0
      ? Math.min(100, ((agent.budgetUsedCents ?? 0) / agent.budgetLimitCents) * 100)
      : 0;

  const budgetColor =
    budgetPct >= 80 ? 'bg-red-500' : budgetPct >= 50 ? 'bg-amber-500' : 'bg-emerald-500';

  return (
    <div className="rounded-xl border border-border bg-card p-5 transition-all duration-200 hover:border-amber-400/40 hover:shadow-[0_0_20px_rgba(212,168,83,0.08)]">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <AgentPulseDot status={agent.status} />
          <button
            type="button"
            onClick={onOpenChief}
            disabled={opening}
            className="font-satoshi font-bold text-base text-foreground hover:text-amber-300 transition-colors disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/40 rounded"
            title="Open Chief workspace"
          >
            {displayName}
          </button>
        </div>
        <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
          {agent.status}
        </span>
      </div>
      {agent.currentTask && (
        <p className="text-sm text-muted-foreground truncate mb-3">{agent.currentTask}</p>
      )}
      {agent.budgetLimitCents ? (
        <div className="space-y-1">
          <div className="h-1.5 w-full rounded-full bg-zinc-800 overflow-hidden">
            <div
              className={cn('h-full rounded-full transition-all', budgetColor)}
              style={{ width: `${budgetPct}%` }}
            />
          </div>
          <div className="flex justify-between text-[11px] font-mono text-muted-foreground">
            <span>{formatCostCents(agent.budgetUsedCents ?? 0)}</span>
            <span>{formatCostCents(agent.budgetLimitCents)}</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function Home() {
  const { tenant, session } = useAuth();
  const [openingAgentId, setOpeningAgentId] = useState<string | null>(null);
  const badgesQuery = useSidebarBadges();
  const agentsQuery = usePaperclipAgents();
  const dashboardQuery = usePaperclipDashboard();

  const companyName = String(tenant?.onboarding_data?.company_name || tenant?.name || 'your company');
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
      await launchChiefWorkspace(accessToken, 'dashboard_home_agent_card');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to open Chief workspace');
    } finally {
      setOpeningAgentId(null);
    }
  };

  // Show full skeleton while either query is loading on first load
  if (badgesQuery.isLoading || agentsQuery.isLoading || dashboardQuery.isLoading) {
    return <HomeSkeleton />;
  }

  // Only read approval count once badges have settled (data or error)
  const pendingApprovals = badgesQuery.data?.approvals ?? 0;
  const badgesResolved = !badgesQuery.isLoading;

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <h1 className="text-2xl font-satoshi font-bold text-foreground">
        Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 18 ? 'afternoon' : 'evening'}
      </h1>

      {/* Approval banner — action-first. Only render once badges query has resolved. */}
      {badgesResolved && pendingApprovals > 0 ? (
        <div className="rounded-xl border border-amber-400/30 bg-amber-500/5 p-5 flex items-center justify-between gap-4">
          <div>
            <p className="text-lg font-bold text-foreground">
              {pendingApprovals} item{pendingApprovals !== 1 ? 's' : ''} need your approval
            </p>
            <p className="text-sm text-muted-foreground mt-0.5">
              Review and approve your Chief's work before it goes live.
            </p>
          </div>
          <Button asChild className="shrink-0">
            <Link to="/dashboard/approvals">Review Approvals</Link>
          </Button>
        </div>
      ) : badgesResolved ? (
        <div className="rounded-xl border border-border bg-card p-5 flex items-center gap-3 text-muted-foreground">
          <CheckSquare className="h-5 w-5 text-emerald-400" />
          <span className="text-sm">Inbox zero — your Chief handled everything</span>
        </div>
      ) : null}

      {/* Quick actions */}
      <div className="flex gap-3">
        <Button asChild variant="outline" size="sm">
          <Link to="/dashboard/approvals">
            <CheckSquare className="h-4 w-4 mr-2" />
            Review Approvals
          </Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link to="/dashboard/tasks">
            <ListTodo className="h-4 w-4 mr-2" />
            View Tasks
          </Link>
        </Button>
      </div>

      {/* Summary from /dashboard (count consistency still comes from sidebar badges) */}
      <section className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-foreground">Weekly cost</p>
            <p className="text-sm text-muted-foreground mt-1">
              {formatCostCents(dashboardQuery.data?.weekCostCents ?? 0)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm font-medium text-foreground">Current focus</p>
            <p className="text-sm text-muted-foreground mt-1">
              {dashboardQuery.data?.currentTask || 'No active focus right now'}
            </p>
          </div>
        </div>
      </section>

      {/* Agent status cards */}
      <section>
        <h2 className="text-sm font-mono uppercase tracking-widest text-muted-foreground mb-3">
          Agents · {companyName}
        </h2>
        <ProxyQueryWrapper
          query={agentsQuery}
          skeleton={
            <div className="grid sm:grid-cols-2 gap-4">
              <AgentCardSkeleton />
              <AgentCardSkeleton />
            </div>
          }
          errorLabel="agent status"
        >
          {(data) => {
            if (!data.agents.length) {
              return (
                <p className="text-sm text-muted-foreground">No agents provisioned.</p>
              );
            }
            return (
              <div className="grid sm:grid-cols-2 gap-4">
                {data.agents.map((agent) => (
                  <AgentSummaryCard
                    key={agent.id}
                    agent={agent}
                    displayName={resolveAgentDisplayName(agent, preferredChiefName)}
                    onOpenChief={() => handleOpenChief(agent.id)}
                    opening={openingAgentId === agent.id}
                  />
                ))}
              </div>
            );
          }}
        </ProxyQueryWrapper>
      </section>

      {/* Intelligence brief placeholder — RC-3: static, no fetch */}
      <section className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center gap-2 mb-2">
          <BrainCircuit className="h-4 w-4 text-amber-400" />
          <span className="text-sm font-semibold text-foreground">Intelligence Brief</span>
        </div>
        <p className="text-sm text-muted-foreground">
          Your Chief is analyzing — check back soon.
        </p>
      </section>
    </div>
  );
}
