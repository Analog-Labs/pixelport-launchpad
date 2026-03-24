import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CheckSquare, ListTodo } from 'lucide-react';
import { useSidebarBadges } from '@/hooks/useSidebarBadges';
import { usePaperclipActivity } from '@/hooks/usePaperclipActivity';
import { usePaperclipAgents } from '@/hooks/usePaperclipAgents';
import { usePaperclipDashboard } from '@/hooks/usePaperclipDashboard';
import { usePaperclipTasks } from '@/hooks/usePaperclipTasks';
import { ProxyQueryWrapper } from '@/components/dashboard/ProxyQueryWrapper';
import { ActivityTimeline } from '@/components/dashboard/ActivityTimeline';
import { CreateTaskPanel } from '@/components/dashboard/CreateTaskPanel';
import { HomeSkeleton } from '@/components/dashboard/DashboardSkeleton';
import { StatCard } from '@/components/dashboard/StatCard';
import { StatusBadge } from '@/components/dashboard/StatusBadge';
import { Button } from '@/components/ui/button';
import { formatCostCents } from '@/lib/costColoring';
import { cn } from '@/lib/utils';
import { parseISO } from 'date-fns';

function byUpdatedAtDesc(a?: string, b?: string): number {
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  return parseISO(b).getTime() - parseISO(a).getTime();
}

export default function Home() {
  const navigate = useNavigate();
  const [createPanelOpen, setCreatePanelOpen] = useState(false);
  const badgesQuery = useSidebarBadges();
  const dashboardQuery = usePaperclipDashboard();
  const tasksQuery = usePaperclipTasks();
  const activityQuery = usePaperclipActivity(8);
  const agentsQuery = usePaperclipAgents();

  const pendingApprovals = badgesQuery.data?.approvals ?? dashboardQuery.data?.pendingApprovals ?? 0;

  const recentTasks = useMemo(() => {
    return [...(tasksQuery.data?.issues ?? [])]
      .sort((left, right) => byUpdatedAtDesc(left.updatedAt, right.updatedAt))
      .slice(0, 5);
  }, [tasksQuery.data?.issues]);

  if (dashboardQuery.isLoading && badgesQuery.isLoading) {
    return <HomeSkeleton />;
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <h1 className="text-2xl font-satoshi font-bold text-foreground">
        Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 18 ? 'afternoon' : 'evening'}
      </h1>

      {pendingApprovals > 0 ? (
        <div className="flex items-center justify-between gap-4 rounded-xl border border-amber-400/30 bg-amber-500/5 p-5">
          <div>
            <p className="text-lg font-bold text-foreground">
              {pendingApprovals} item{pendingApprovals !== 1 ? 's' : ''} need your approval
            </p>
            <p className="text-sm text-muted-foreground">Review and approve before content goes live.</p>
          </div>
          <Button asChild className="shrink-0 min-h-[44px] sm:min-h-0 shimmer-btn">
            <Link to="/dashboard/approvals">Review Approvals</Link>
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-5 text-muted-foreground">
          <CheckSquare className="h-5 w-5 text-emerald-400" />
          <span className="text-sm">Inbox zero — your Chief handled everything</span>
        </div>
      )}

      <section className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard
          value={String(dashboardQuery.data?.agents.active ?? 0)}
          label="Agents Enabled"
          subtitle={`${dashboardQuery.data?.agents.running ?? 0} running · ${dashboardQuery.data?.agents.paused ?? 0} paused · ${dashboardQuery.data?.agents.error ?? 0} errors`}
          onClick={() => navigate('/dashboard/agents')}
        />
        <StatCard
          value={String(dashboardQuery.data?.tasks.inProgress ?? 0)}
          label="Tasks In Progress"
          subtitle={`${dashboardQuery.data?.tasks.open ?? 0} open · ${dashboardQuery.data?.tasks.blocked ?? 0} blocked`}
          onClick={() => navigate('/dashboard/tasks')}
        />
        <StatCard
          value={formatCostCents(dashboardQuery.data?.costs.monthSpendCents ?? 0)}
          label="Month Spend"
          subtitle={
            (dashboardQuery.data?.costs.monthBudgetCents ?? 0) > 0
              ? `${Math.round(dashboardQuery.data?.costs.monthUtilizationPercent ?? 0)}% of budget`
              : 'Unlimited budget'
          }
          onClick={() => navigate('/dashboard/costs')}
        />
        <StatCard
          value={String(pendingApprovals)}
          label="Pending Approvals"
          subtitle="Awaiting review"
          onClick={() => navigate('/dashboard/approvals')}
        />
      </section>

      <section className="rounded-xl border border-border bg-card p-5">
        <div className="mb-3 flex items-center justify-between gap-2">
          <p className="font-satoshi text-lg font-bold text-foreground">Recent Tasks</p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCreatePanelOpen(true)}
              className="min-h-[40px] sm:min-h-0"
            >
              New Task
            </Button>
            <Link to="/dashboard/tasks" className="text-sm text-amber-400 hover:text-amber-300">
              See all
            </Link>
          </div>
        </div>

        <ProxyQueryWrapper
          query={tasksQuery}
          skeleton={
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="h-12 animate-pulse rounded bg-amber-500/5" />
              ))}
            </div>
          }
          errorLabel="recent tasks"
        >
          {() => {
            if (!recentTasks.length) {
              return <p className="text-sm text-muted-foreground">No tasks yet — create your first.</p>;
            }
            return (
              <div className="space-y-2">
                {recentTasks.map((task) => (
                  <Link
                    key={task.id}
                    to="/dashboard/tasks"
                    className={cn(
                      'grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-lg border border-border px-3 py-2',
                      'transition-all hover:border-amber-400/40 hover:shadow-[0_0_20px_rgba(212,168,83,0.08)]',
                    )}
                  >
                    <span className="font-mono text-[11px] text-muted-foreground">
                      {task.identifier ?? (task.number ? `#${task.number}` : task.id.slice(0, 6))}
                    </span>
                    <p className="truncate text-sm text-foreground">{task.title}</p>
                    <StatusBadge status={task.status} />
                  </Link>
                ))}
              </div>
            );
          }}
        </ProxyQueryWrapper>
      </section>

      <section className="rounded-xl border border-border bg-card p-5">
        <div className="mb-3 flex items-center justify-between gap-2">
          <p className="font-satoshi text-lg font-bold text-foreground">Recent Activity</p>
          <Link to="/dashboard/inbox" className="text-sm text-amber-400 hover:text-amber-300">
            Open Inbox
          </Link>
        </div>
        <ProxyQueryWrapper
          query={activityQuery}
          skeleton={
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="h-12 animate-pulse rounded bg-amber-500/5" />
              ))}
            </div>
          }
          errorLabel="activity feed"
        >
          {(data) => (
            <ActivityTimeline
              entries={data.entries}
              emptyLabel="No activity yet — your Chief will start soon."
            />
          )}
        </ProxyQueryWrapper>
      </section>

      <section className="rounded-xl border border-border bg-card p-5">
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="font-satoshi text-lg font-bold text-foreground">Agents</p>
          <Link to="/dashboard/agents" className="text-sm text-amber-400 hover:text-amber-300">
            Open agents
          </Link>
        </div>
        {agentsQuery.data?.agents?.length ? (
          <div className="flex flex-wrap gap-2">
            {agentsQuery.data.agents.map((agent) => (
              <Link
                key={agent.id}
                to={`/dashboard/agents/${agent.id}`}
                className="inline-flex items-center gap-2 rounded-full border border-border bg-zinc-900/60 px-3 py-1.5 text-sm text-foreground hover:border-amber-400/40"
              >
                <span className={cn('h-1.5 w-1.5 rounded-full', agent.status === 'running' ? 'bg-amber-500' : agent.status === 'online' ? 'bg-emerald-500' : 'bg-zinc-500')} />
                <span>{agent.name}</span>
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No agents provisioned.</p>
        )}
      </section>

      <section className="rounded-xl border border-border bg-card p-5">
        <div className="mb-2 flex items-center gap-2">
          <ListTodo className="h-4 w-4 text-amber-400" />
          <span className="text-sm font-semibold text-foreground">Intelligence Brief</span>
        </div>
        <p className="text-sm text-muted-foreground">Your Chief is analyzing — check back soon.</p>
      </section>

      <CreateTaskPanel
        open={createPanelOpen}
        onClose={() => setCreatePanelOpen(false)}
        agents={agentsQuery.data?.agents ?? []}
      />
    </div>
  );
}
