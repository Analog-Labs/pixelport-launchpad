import { Link } from 'react-router-dom';
import { CheckSquare, ListTodo, BrainCircuit } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { usePaperclipSidebarBadges } from '@/hooks/usePaperclipSidebarBadges';
import { usePaperclipAgents } from '@/hooks/usePaperclipAgents';
import { ProxyQueryWrapper } from '@/components/dashboard/ProxyQueryWrapper';
import { AgentCardSkeleton, HomeSkeleton } from '@/components/dashboard/DashboardSkeleton';
import { Button } from '@/components/ui/button';
import { formatCostCents } from '@/lib/costColoring';
import type { PaperclipAgent } from '@/lib/paperclip-types';
import { cn } from '@/lib/utils';

function AgentPulseDot({ status }: { status: PaperclipAgent['status'] }) {
  const color =
    status === 'online'
      ? 'bg-emerald-500'
      : status === 'running'
        ? 'bg-amber-500'
        : 'bg-zinc-500';

  const pulse = status === 'online' || status === 'running';

  return (
    <span className="relative inline-flex h-2 w-2 shrink-0">
      <span
        className={cn(
          'absolute inline-flex h-full w-full rounded-full opacity-75',
          color,
          pulse && 'animate-ping',
        )}
      />
      <span className={cn('relative inline-flex h-2 w-2 rounded-full', color)} />
    </span>
  );
}

function AgentSummaryCard({ agent }: { agent: PaperclipAgent }) {
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
          <span className="font-satoshi font-bold text-base text-foreground">{agent.name}</span>
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
  const { tenant } = useAuth();
  const badgesQuery = usePaperclipSidebarBadges();
  const agentsQuery = usePaperclipAgents();

  const companyName = String(tenant?.onboarding_data?.company_name || tenant?.name || 'your company');

  // Show full skeleton while either query is loading on first load
  if (badgesQuery.isLoading || agentsQuery.isLoading) {
    return <HomeSkeleton />;
  }

  // Only read approval count once badges have settled (data or error)
  const pendingApprovals = badgesQuery.data?.approvals ?? 0;
  const badgesResolved = !badgesQuery.isLoading;

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
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
                  <AgentSummaryCard key={agent.id} agent={agent} />
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
