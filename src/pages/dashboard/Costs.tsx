import { ProxyQueryWrapper } from '@/components/dashboard/ProxyQueryWrapper';
import { StatusBadge } from '@/components/dashboard/StatusBadge';
import { usePaperclipCostsByAgent } from '@/hooks/usePaperclipCosts';
import { usePaperclipDashboard } from '@/hooks/usePaperclipDashboard';
import { formatCostCents } from '@/lib/costColoring';

export default function Costs() {
  const costsQuery = usePaperclipCostsByAgent();
  const dashboardQuery = usePaperclipDashboard();

  const monthSpend = dashboardQuery.data?.costs.monthSpendCents ?? 0;
  const monthBudget = dashboardQuery.data?.costs.monthBudgetCents ?? 0;
  const monthUtilization = Math.round(dashboardQuery.data?.costs.monthUtilizationPercent ?? 0);

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <h1 className="text-2xl font-satoshi font-bold text-foreground">Costs</h1>

      <div className="rounded-xl border border-border bg-card p-5 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-lg font-bold text-foreground">{formatCostCents(monthSpend)}</p>
          <p className="text-sm text-muted-foreground">
            {monthBudget > 0 ? `${monthUtilization}% of ${formatCostCents(monthBudget)}` : 'Unlimited budget'}
          </p>
        </div>
        <div className="h-2 w-full rounded-full bg-zinc-800 overflow-hidden">
          <div
            className="h-full rounded-full bg-amber-400/70 transition-all"
            style={{ width: `${Math.min(100, monthUtilization)}%` }}
          />
        </div>
      </div>

      <ProxyQueryWrapper
        query={costsQuery}
        skeleton={
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-14 rounded-lg bg-amber-500/5 animate-pulse" />
            ))}
          </div>
        }
        errorLabel="costs"
      >
        {(data) => {
          if (!data.agents.length) {
            return (
              <div className="rounded-xl border border-border bg-card p-10 text-center">
                <p className="text-muted-foreground">No cost data yet — your agent hasn&apos;t run yet.</p>
              </div>
            );
          }

          return (
            <div className="overflow-x-auto rounded-xl border border-border bg-card">
              <table className="min-w-[720px] w-full">
                <thead>
                  <tr className="border-b border-border bg-zinc-900/60 text-left">
                    <th className="px-4 py-2 font-mono text-[11px] uppercase tracking-widest text-muted-foreground/70">Agent</th>
                    <th className="px-4 py-2 font-mono text-[11px] uppercase tracking-widest text-muted-foreground/70">Status</th>
                    <th className="px-4 py-2 font-mono text-[11px] uppercase tracking-widest text-muted-foreground/70">Cost</th>
                    <th className="px-4 py-2 font-mono text-[11px] uppercase tracking-widest text-muted-foreground/70">Input Tokens</th>
                    <th className="px-4 py-2 font-mono text-[11px] uppercase tracking-widest text-muted-foreground/70">Output Tokens</th>
                  </tr>
                </thead>
                <tbody>
                  {data.agents.map((agent) => (
                    <tr key={agent.agentId} className="border-b border-border last:border-b-0">
                      <td className="px-4 py-3 text-sm text-foreground">{agent.agentName}</td>
                      <td className="px-4 py-3"><StatusBadge status={agent.agentStatus} /></td>
                      <td className="px-4 py-3 font-mono text-sm text-foreground">{formatCostCents(agent.costCents)}</td>
                      <td className="px-4 py-3 font-mono text-sm text-muted-foreground">{agent.inputTokens.toLocaleString()}</td>
                      <td className="px-4 py-3 font-mono text-sm text-muted-foreground">{agent.outputTokens.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }}
      </ProxyQueryWrapper>
    </div>
  );
}
